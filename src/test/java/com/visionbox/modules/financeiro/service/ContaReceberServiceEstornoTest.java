package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.MovimentarCaixaRequest;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.domain.ContaReceberPagamento;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento.TipoFormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.mapper.ContaReceberMapper;
import com.visionbox.modules.financeiro.repository.ContaReceberPagamentoRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Estorno de baixa de Conta a Receber (§3.3 — pendência D-012, decisão D-017).
 * Pontos cobertos: reabertura integral (PENDENTE), reabertura parcial com
 * valor_aberto correto, rejeição de conta CANCELADA, escopo loja/conta (R1 → 404),
 * soft-delete da linha, movimento ESTORNO no caixa aberto e prosseguimento sem caixa.
 */
class ContaReceberServiceEstornoTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private ContaReceberRepository repository;
    private ContaReceberMapper mapper;
    private ContaReceberPagamentoRepository pagamentoRepository;
    private FormaPagamentoRepository formaPagamentoRepository;
    private CaixaSessaoRepository caixaSessaoRepository;
    private CaixaService caixaService;
    private ContaReceberService service;

    @BeforeEach
    void setUp() {
        repository = mock(ContaReceberRepository.class);
        mapper = mock(ContaReceberMapper.class);
        pagamentoRepository = mock(ContaReceberPagamentoRepository.class);
        formaPagamentoRepository = mock(FormaPagamentoRepository.class);
        caixaSessaoRepository = mock(CaixaSessaoRepository.class);
        caixaService = mock(CaixaService.class);
        service = new ContaReceberService(repository, mapper, pagamentoRepository,
                formaPagamentoRepository, caixaSessaoRepository, caixaService);
        TenantContext.setCurrentLojaId(LOJA);

        when(mapper.toResponse(any())).thenAnswer(inv -> new ContaReceberResponse());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(pagamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // por padrão: nenhum caixa aberto (estorno não trava sem turno)
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.empty());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void estornoIntegral_reabreComoPendente_zeraValorPago_eSoftDeletaLinha() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        ContaReceberPagamento baixa = pagamento(conta.getId(), "100.00");
        stubPagamento(conta, baixa);

        service.estornarPagamento(conta.getId(), baixa.getId(), "cheque sem fundo");

        // valor_aberto é GENERATED (valor - valor_pago): fonte do recálculo é valor_pago
        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PENDENTE
                        && c.getValorPago().compareTo(BigDecimal.ZERO.setScale(2)) == 0
                        && c.getSaldo().compareTo(new BigDecimal("100.00")) == 0
                        && c.getDataPagamento() == null));
        verify(pagamentoRepository).save(argThat((ContaReceberPagamento p) ->
                !p.isAtivo() && baixa.getId().equals(p.getId())));
    }

    @Test
    void estornoDeUmaDeDuasBaixas_voltaParcial_comValorAbertoCorreto() {
        // título 100 quitado com duas baixas (40 + 60); estornando a de 40 sobra pago 60 → PARCIAL, aberto 40
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        ContaReceberPagamento baixa40 = pagamento(conta.getId(), "40.00");
        stubPagamento(conta, baixa40);

        service.estornarPagamento(conta.getId(), baixa40.getId(), null);

        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PARCIAL
                        && c.getValorPago().compareTo(new BigDecimal("60.00")) == 0
                        && c.getSaldo().compareTo(new BigDecimal("40.00")) == 0
                        && c.getDataPagamento() == null));
    }

    @Test
    void contaCancelada_rejeitaEstorno() {
        ContaReceber conta = conta(ContaReceber.StatusConta.CANCELADO, "100.00", "50.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.estornarPagamento(conta.getId(), UUID.randomUUID(), null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("cancelada não aceita estorno");
        verify(pagamentoRepository, never()).save(any());
        verify(repository, never()).save(any());
        verify(caixaService, never()).movimentar(any(), any());
    }

    @Test
    void pagamentoDeOutraContaOuLoja_naoEncontrado_r1() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        UUID pagamentoDeOutraConta = UUID.randomUUID();
        when(pagamentoRepository.findByIdAndLojaIdAndContaReceberId(
                pagamentoDeOutraConta, LOJA, conta.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.estornarPagamento(conta.getId(), pagamentoDeOutraConta, null))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Pagamento não encontrado");
        verify(pagamentoRepository, never()).save(any());
    }

    @Test
    void comCaixaAberto_lancaMovimentoEstorno_comValorEFormaDaBaixaOriginal() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "30.00");
        stubConta(conta);
        FormaPagamento pix = forma(TipoFormaPagamento.PIX);
        ContaReceberPagamento baixa = pagamento(conta.getId(), "30.00", pix.getId());
        stubPagamento(conta, baixa);
        when(formaPagamentoRepository.findByIdAndLojaId(pix.getId(), LOJA)).thenReturn(Optional.of(pix));
        CaixaSessao aberta = caixaAberta();
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.of(aberta));

        service.estornarPagamento(conta.getId(), baixa.getId(), "cliente contestou no banco");

        verify(caixaService).movimentar(eq(LOJA), argThat((MovimentarCaixaRequest r) ->
                r.tipo() == CaixaMovimento.TipoMovimento.ESTORNO
                        && r.valor().compareTo(new BigDecimal("30.00")) == 0
                        && "PIX".equals(r.formaPagamento())
                        && r.motivo() != null && r.motivo().contains("Estorno de baixa")
                        && r.motivo().contains("cliente contestou no banco")));
    }

    @Test
    void semCaixaAberto_estornoProssegue_semMovimento() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        ContaReceberPagamento baixa = pagamento(conta.getId(), "100.00");
        stubPagamento(conta, baixa);

        service.estornarPagamento(conta.getId(), baixa.getId(), null);

        verify(caixaService, never()).movimentar(any(), any());
        verify(pagamentoRepository).save(argThat((ContaReceberPagamento p) -> !p.isAtivo()));
        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PENDENTE));
    }

    @Test
    void formaDaBaixaRemovida_movimentoEstornoVoltaParaDinheiro() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        UUID formaRemovida = UUID.randomUUID();
        ContaReceberPagamento baixa = pagamento(conta.getId(), "100.00", formaRemovida);
        stubPagamento(conta, baixa);
        when(formaPagamentoRepository.findByIdAndLojaId(formaRemovida, LOJA)).thenReturn(Optional.empty());
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.of(caixaAberta()));

        service.estornarPagamento(conta.getId(), baixa.getId(), null);

        verify(caixaService).movimentar(eq(LOJA), argThat((MovimentarCaixaRequest r) ->
                "DINHEIRO".equals(r.formaPagamento())));
    }

    @Test
    void estornoInconsistente_valorPagoDaBaixaMaiorQueTotalPago_falhaAlto() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "30.00");
        stubConta(conta);
        ContaReceberPagamento baixa = pagamento(conta.getId(), "70.00");
        stubPagamento(conta, baixa);

        assertThatThrownBy(() -> service.estornarPagamento(conta.getId(), baixa.getId(), null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("inconsistente");
        verify(pagamentoRepository, never()).save(any());
    }

    /* ----------------- V41 — estorno simétrico ao desconto/juros (D-021) ----------------- */

    @Test
    void estornoDeBaixaComDesconto_devolveValorPagoMaisDesconto_aoValorPagoDaConta() {
        // Título 100 quitado com 90 + desconto 10 (valor_pago=100). Estorno devolve 100 → PENDENTE, aberto 100.
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        ContaReceberPagamento baixa = pagamentoComDescontoJuros(conta.getId(), "90.00", "10.00", null, null);
        stubPagamento(conta, baixa);

        service.estornarPagamento(conta.getId(), baixa.getId(), "desconto revertido");

        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PENDENTE
                        && c.getValorPago().compareTo(BigDecimal.ZERO.setScale(2)) == 0
                        && c.getSaldo().compareTo(new BigDecimal("100.00")) == 0));
    }

    @Test
    void estornoDeUmaBaixaComDesconto_entreDuas_mantemAbertoCorreto() {
        // Título 100 quitado com (50 + desc 10) e (40): valor_pago=100. Estornando a primeira
        // devolve 60 → restam 40 pagos → PARCIAL, aberto 60.
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);
        ContaReceberPagamento baixaComDesconto = pagamentoComDescontoJuros(conta.getId(), "50.00", "10.00", null, null);
        stubPagamento(conta, baixaComDesconto);

        service.estornarPagamento(conta.getId(), baixaComDesconto.getId(), null);

        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PARCIAL
                        && c.getValorPago().compareTo(new BigDecimal("40.00")) == 0
                        && c.getSaldo().compareTo(new BigDecimal("60.00")) == 0));
    }

    @Test
    void estornoDeBaixaComJuros_movimentoCaixaDevolveValorPagoMaisJuros() {
        // Baixa de 30 com juros 2 colocou 32 no caixa — o ESTORNO tira 32, não 30.
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "30.00");
        stubConta(conta);
        FormaPagamento pix = forma(TipoFormaPagamento.PIX);
        ContaReceberPagamento baixa = pagamentoComDescontoJuros(conta.getId(), "30.00", null, "2.00", pix.getId());
        stubPagamento(conta, baixa);
        when(formaPagamentoRepository.findByIdAndLojaId(pix.getId(), LOJA)).thenReturn(Optional.of(pix));
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.of(caixaAberta()));

        service.estornarPagamento(conta.getId(), baixa.getId(), null);

        verify(caixaService).movimentar(eq(LOJA), argThat((MovimentarCaixaRequest r) ->
                r.tipo() == CaixaMovimento.TipoMovimento.ESTORNO
                        && r.valor().compareTo(new BigDecimal("32.00")) == 0));
        // juros não abateram o título: valor_pago da conta volta só 30 → 0 → aberto 100, PENDENTE
        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PENDENTE
                        && c.getValorPago().compareTo(new BigDecimal("0.00")) == 0
                        && c.getSaldo().compareTo(new BigDecimal("100.00")) == 0));
    }

    // ---- helpers ----

    private void stubConta(ContaReceber conta) {
        when(repository.findByIdAndLojaId(conta.getId(), LOJA)).thenReturn(Optional.of(conta));
    }

    private void stubPagamento(ContaReceber conta, ContaReceberPagamento pagamento) {
        when(pagamentoRepository.findByIdAndLojaIdAndContaReceberId(
                pagamento.getId(), LOJA, conta.getId())).thenReturn(Optional.of(pagamento));
    }

    private ContaReceber conta(ContaReceber.StatusConta status, String valor, String valorPago) {
        return ContaReceber.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA)
                .descricao("Venda PDV/OS teste")
                .valor(new BigDecimal(valor))
                .valorPago(new BigDecimal(valorPago))
                .vencimento(LocalDate.now().plusDays(15))
                .status(status)
                .build();
    }

    private ContaReceberPagamento pagamento(UUID contaId, String valor) {
        return pagamento(contaId, valor, null);
    }

    private ContaReceberPagamento pagamento(UUID contaId, String valor, UUID formaPagamentoId) {
        return pagamentoComDescontoJuros(contaId, valor, null, null, formaPagamentoId);
    }

    /** V41 — linha de baixa com desconto/juros gravados (D-021). */
    private ContaReceberPagamento pagamentoComDescontoJuros(UUID contaId, String valor,
                                                            String desconto, String juros, UUID formaPagamentoId) {
        return ContaReceberPagamento.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA)
                .contaReceberId(contaId)
                .valorPago(new BigDecimal(valor))
                .valorDesconto(desconto != null ? new BigDecimal(desconto) : null)
                .valorJuros(juros != null ? new BigDecimal(juros) : null)
                .formaPagamentoId(formaPagamentoId)
                .dataPagamento(OffsetDateTime.now())
                .build();
    }

    private FormaPagamento forma(TipoFormaPagamento tipo) {
        return FormaPagamento.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA)
                .nome(tipo.name())
                .tipo(tipo)
                .ativo(true)
                .build();
    }

    private CaixaSessao caixaAberta() {
        return CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .abertoEm(OffsetDateTime.now())
                .build();
    }
}
