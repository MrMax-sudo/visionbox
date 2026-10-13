package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.MovimentarCaixaRequest;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.domain.ContaReceberPagamento;
import com.visionbox.modules.financeiro.dto.BaixaContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento.TipoFormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.mapper.ContaReceberMapper;
import com.visionbox.modules.financeiro.repository.ContaReceberPagamentoRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Fase 3 Robustez §3.3 — baixas parciais de Conta a Receber com histórico e caixa.
 * Pontos cobertos: PARCIAL, PAGO, rejeição acima do aberto, histórico gravado,
 * vinculação ao caixa aberto (ENTRADA/RECEBIMENTO_FIADO) e ausência de caixa.
 */
class ContaReceberServiceBaixaTest {

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
        // por padrão: nenhum caixa aberto (baixa não trava sem turno)
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.empty());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void baixaParcial_viraParcial_eDebitaSaldo() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        service.baixar(conta.getId(), new BigDecimal("40.00"));

        verify(repository).save(argThat(c ->
                c.getStatus() == ContaReceber.StatusConta.PARCIAL
                        && c.getValorPago().compareTo(new BigDecimal("40.00")) == 0
                        && c.getDataPagamento() == null));
    }

    @Test
    void baixaTotal_zerandoSaldo_viraPago_comDataPagamento() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "30.00");
        stubConta(conta);

        // sem valor no request → baixa o saldo em aberto integral (70.00)
        service.baixar(conta.getId(), new BaixaContaReceberRequest());

        verify(repository).save(argThat(c ->
                c.getStatus() == ContaReceber.StatusConta.PAGO
                        && c.getValorPago().compareTo(new BigDecimal("100.00")) == 0
                        && c.getDataPagamento() != null));
    }

    @Test
    void baixaAcimaDoAberto_rejeitada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "80.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), new BigDecimal("20.01")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("excede o valor em aberto");
        verify(repository, never()).save(any());
        verify(pagamentoRepository, never()).save(any());
    }

    @Test
    void baixaValorNaoPositivo_rejeitada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maior que zero");
        verify(pagamentoRepository, never()).save(any());
    }

    @Test
    void baixa_gravaHistorico_comFormaEObservacao() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);
        FormaPagamento forma = forma(TipoFormaPagamento.PIX);
        when(formaPagamentoRepository.findByIdAndLojaId(forma.getId(), LOJA)).thenReturn(Optional.of(forma));

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("50.00"))
                .formaPagamentoId(forma.getId())
                .observacao("1ª parcela via PIX")
                .build());

        verify(pagamentoRepository).save(argThat((ContaReceberPagamento p) ->
                LOJA.equals(p.getLojaId())
                        && conta.getId().equals(p.getContaReceberId())
                        && p.getValorPago().compareTo(new BigDecimal("50.00")) == 0
                        && forma.getId().equals(p.getFormaPagamentoId())
                        && "1ª parcela via PIX".equals(p.getObservacao())
                        && p.getDataPagamento() != null));
    }

    @Test
    void baixaSemCaixaAberto_naoLancaMovimento_caixaIdNuloNoHistorico() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        service.baixar(conta.getId(), new BigDecimal("10.00"));

        verify(caixaService, never()).movimentar(any(), any());
        verify(pagamentoRepository).save(argThat(p -> p.getCaixaId() == null));
    }

    @Test
    void baixaDinheiroComCaixaAberto_lancaMovimentoEntrada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);
        FormaPagamento dinheiro = forma(TipoFormaPagamento.DINHEIRO);
        when(formaPagamentoRepository.findByIdAndLojaId(dinheiro.getId(), LOJA)).thenReturn(Optional.of(dinheiro));
        CaixaSessao aberta = caixaAberta();
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.of(aberta));

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("100.00"))
                .formaPagamentoId(dinheiro.getId())
                .build());

        verify(caixaService).movimentar(eq(LOJA), argThat((MovimentarCaixaRequest r) ->
                r.tipo() == CaixaMovimento.TipoMovimento.ENTRADA
                        && r.valor().compareTo(new BigDecimal("100.00")) == 0));
        verify(pagamentoRepository).save(argThat(p -> aberta.getId().equals(p.getCaixaId())));
    }

    @Test
    void baixaCreditoComCaixaAberto_lancaRecebimentoFiado() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);
        FormaPagamento credito = forma(TipoFormaPagamento.CREDITO);
        when(formaPagamentoRepository.findByIdAndLojaId(credito.getId(), LOJA)).thenReturn(Optional.of(credito));
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.of(caixaAberta()));

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("100.00"))
                .formaPagamentoId(credito.getId())
                .build());

        verify(caixaService).movimentar(eq(LOJA), argThat((MovimentarCaixaRequest r) ->
                r.tipo() == CaixaMovimento.TipoMovimento.RECEBIMENTO_FIADO));
    }

    @Test
    void baixaContaCancelada_rejeitada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.CANCELADO, "100.00", "0.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), new BigDecimal("10.00")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cancelada");
    }

    @Test
    void baixaContaJaPaga_rejeitada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PAGO, "100.00", "100.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), new BigDecimal("10.00")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("totalmente paga");
    }

    @Test
    void baixaFormaPagamentoInexistente_lancaNotFound() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);
        UUID formaInexistente = UUID.randomUUID();
        when(formaPagamentoRepository.findByIdAndLojaId(formaInexistente, LOJA)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .formaPagamentoId(formaInexistente).build()))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("Forma de pagamento");
    }

    @Test
    void listarPagamentos_contaInexistente_lancaNotFound() {
        when(repository.findByIdAndLojaId(any(), eq(LOJA))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listarPagamentos(UUID.randomUUID()))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void listarPagamentos_retornaHistoricoOrdenado() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "50.00");
        stubConta(conta);
        when(pagamentoRepository.findByLojaIdAndContaReceberIdOrderByDataPagamentoAsc(LOJA, conta.getId()))
                .thenReturn(List.of(pagamento(conta.getId(), "50.00")));

        var result = service.listarPagamentos(conta.getId());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getValorPago()).isEqualByComparingTo("50.00");
    }

    /* ----------------- V41 — baixa com desconto/juros (D-021) ----------------- */

    @Test
    void baixaComDesconto_quitaSemDinheiroExtra_viraPago_comValorPagoAgregadoSomandoDesconto() {
        // Saldo 100: cliente paga 90 e a loja concede desconto de 10 → valor_pago=100, aberto=0, PAGO
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("90.00"))
                .desconto(new BigDecimal("10.00"))
                .build());

        // valor_aberto é GENERATED (valor - valor_pago): fonte = valor_pago somando valorPago + desconto
        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PAGO
                        && c.getValorPago().compareTo(new BigDecimal("100.00")) == 0
                        && c.getSaldo().compareTo(BigDecimal.ZERO) == 0
                        && c.getDataPagamento() != null));
        // linha do histórico grava dinheiro (90) e desconto (10) separados
        verify(pagamentoRepository).save(argThat((ContaReceberPagamento p) ->
                p.getValorPago().compareTo(new BigDecimal("90.00")) == 0
                        && p.getValorDesconto().compareTo(new BigDecimal("10.00")) == 0
                        && p.getValorJuros().compareTo(BigDecimal.ZERO) == 0));
    }

    @Test
    void baixaComDescontoParcial_debitaValorPagoMaisDesconto_eFicaParcial() {
        // Saldo 100: paga 50 + desconto 10 → abatidos 60, restam 40 → PARCIAL
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("50.00"))
                .desconto(new BigDecimal("10.00"))
                .build());

        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PARCIAL
                        && c.getValorPago().compareTo(new BigDecimal("60.00")) == 0
                        && c.getSaldo().compareTo(new BigDecimal("40.00")) == 0));
    }

    @Test
    void baixaComJuros_naoAlteraValorAberto_masJurosEntramNoMovimentoDeCaixa() {
        // Saldo 100 pago com 100 + juros 5: conta recebe SÓ 100 (aberto zerado, PAGO);
        // no caixa entraram 105 (dinheiro que foi para a gaveta/banco).
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);
        FormaPagamento dinheiro = forma(TipoFormaPagamento.DINHEIRO);
        when(formaPagamentoRepository.findByIdAndLojaId(dinheiro.getId(), LOJA)).thenReturn(Optional.of(dinheiro));
        when(caixaSessaoRepository.findSessaoAbertaAtual(LOJA)).thenReturn(Optional.of(caixaAberta()));

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("100.00"))
                .juros(new BigDecimal("5.00"))
                .formaPagamentoId(dinheiro.getId())
                .build());

        verify(repository).save(argThat((ContaReceber c) ->
                c.getStatus() == ContaReceber.StatusConta.PAGO
                        && c.getValorPago().compareTo(new BigDecimal("100.00")) == 0
                        && c.getSaldo().compareTo(BigDecimal.ZERO) == 0));
        verify(caixaService).movimentar(eq(LOJA), argThat((MovimentarCaixaRequest r) ->
                r.valor().compareTo(new BigDecimal("105.00")) == 0));
        verify(pagamentoRepository).save(argThat((ContaReceberPagamento p) ->
                p.getValorPago().compareTo(new BigDecimal("100.00")) == 0
                        && p.getValorJuros().compareTo(new BigDecimal("5.00")) == 0
                        && p.getValorDesconto().compareTo(BigDecimal.ZERO) == 0));
    }

    @Test
    void baixaValorPagoMaisDescontoExcedeAberto_rejeitada() {
        // Saldo 20: 15 + desconto 6 = 21 > 20 → 400 (IllegalArgumentException)
        ContaReceber conta = conta(ContaReceber.StatusConta.PARCIAL, "100.00", "80.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("15.00"))
                .desconto(new BigDecimal("6.00"))
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("excede o valor em aberto");
        verify(repository, never()).save(any());
        verify(pagamentoRepository, never()).save(any());
        verify(caixaService, never()).movimentar(any(), any());
    }

    @Test
    void baixaDescontoNegativo_rejeitada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("50.00"))
                .desconto(new BigDecimal("-0.01"))
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("desconto não pode ser negativo");
        verify(pagamentoRepository, never()).save(any());
    }

    @Test
    void baixaJurosNegativo_rejeitada() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        assertThatThrownBy(() -> service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("50.00"))
                .juros(new BigDecimal("-1.00"))
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("juros não pode ser negativo");
        verify(pagamentoRepository, never()).save(any());
    }

    @Test
    void baixaComDescontoEJuros_observacaoDaLinhaRegistraAmbos() {
        ContaReceber conta = conta(ContaReceber.StatusConta.PENDENTE, "100.00", "0.00");
        stubConta(conta);

        service.baixar(conta.getId(), BaixaContaReceberRequest.builder()
                .valorPago(new BigDecimal("88.00"))
                .desconto(new BigDecimal("10.00"))
                .juros(new BigDecimal("2.00"))
                .observacao("acordo com o cliente")
                .build());

        verify(pagamentoRepository).save(argThat((ContaReceberPagamento p) ->
                p.getObservacao() != null
                        && p.getObservacao().contains("acordo com o cliente")
                        && p.getObservacao().contains("desconto R$ 10.00")
                        && p.getObservacao().contains("juros R$ 2.00")));
    }

    // ---- helpers ----

    private void stubConta(ContaReceber conta) {
        when(repository.findByIdAndLojaId(conta.getId(), LOJA)).thenReturn(Optional.of(conta));
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

    private ContaReceberPagamento pagamento(UUID contaId, String valor) {
        return ContaReceberPagamento.builder()
                .id(UUID.randomUUID())
                .lojaId(LOJA)
                .contaReceberId(contaId)
                .valorPago(new BigDecimal(valor))
                .dataPagamento(OffsetDateTime.now())
                .build();
    }
}
