package com.visionbox.modules.caixa;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.*;
import com.visionbox.modules.caixa.repository.CaixaMovimentoRepository;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.repository.OrdemServicoPagamentoRepository;
import com.visionbox.shared.error.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CaixaServiceTest {

    @Mock
    private CaixaSessaoRepository sessaoRepository;

    @Mock
    private CaixaMovimentoRepository movimentoRepository;

    @Mock
    private FormaPagamentoRepository formaPagamentoRepository;

    @Mock
    private OrdemServicoPagamentoRepository pagamentoRepository;

    @InjectMocks
    private CaixaService caixaService;

    private UUID lojaId;
    private UUID usuarioId;

    @BeforeEach
    void setUp() {
        lojaId = UUID.randomUUID();
        usuarioId = UUID.randomUUID();
    }

    private CaixaSessao sessaoAbertaPadrao() {
        return CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .usuarioId(usuarioId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .abertoEm(OffsetDateTime.now().minusHours(6))
                .saldoInicial(new BigDecimal("200.00"))
                .saldoEsperado(new BigDecimal("200.00"))
                .totalEntradas(BigDecimal.ZERO)
                .totalSaidas(BigDecimal.ZERO)
                .movimentos(new ArrayList<>())
                .build();
    }

    @Test
    @DisplayName("Deve abrir sessão de caixa com sucesso e registrar fundo de troco")
    void deveAbrirCaixaComSucesso() {
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.empty());
        when(sessaoRepository.save(any(CaixaSessao.class))).thenAnswer(inv -> {
            CaixaSessao s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        AbrirCaixaRequest req = new AbrirCaixaRequest(
                new BigDecimal("150.00"),
                "CAIXA_01",
                "Carlos Operador"
        );

        CaixaSessaoDTO dto = caixaService.abrirCaixa(lojaId, usuarioId, req);

        assertThat(dto).isNotNull();
        assertThat(dto.status()).isEqualTo(CaixaSessao.StatusCaixa.ABERTO);
        assertThat(dto.saldoInicial()).isEqualByComparingTo("150.00");
        assertThat(dto.saldoEsperado()).isEqualByComparingTo("150.00");
        verify(movimentoRepository, times(1)).save(any(CaixaMovimento.class));
    }

    @Test
    @DisplayName("Deve impedir abertura de segundo caixa se já houver um aberto")
    void deveImpedirAberturaDuplicada() {
        CaixaSessao sessaoAberta = CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .build();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessaoAberta));

        AbrirCaixaRequest req = new AbrirCaixaRequest(BigDecimal.TEN, "CAIXA_01", "Op");

        assertThatThrownBy(() -> caixaService.abrirCaixa(lojaId, usuarioId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Já existe uma sessão de caixa aberta");
    }

    @Test
    @DisplayName("Deve registrar sangria e abater do saldo esperado")
    void deveRegistrarSangria() {
        CaixaSessao sessao = sessaoAbertaPadrao();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        MovimentarCaixaRequest req = new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.SANGRIA,
                new BigDecimal("50.00"),
                "DINHEIRO",
                "Depósito no cofre",
                "Gerente"
        );

        CaixaSessaoDTO dto = caixaService.movimentar(lojaId, req);

        assertThat(dto.saldoEsperado()).isEqualByComparingTo("150.00");
        assertThat(dto.totalSaidas()).isEqualByComparingTo("50.00");
        verify(movimentoRepository).save(any(CaixaMovimento.class));
    }

    @Test
    @DisplayName("Baixa de título em dinheiro (ENTRADA): soma entradas e gaveta — evita QUEBRA falsa no fechamento cego")
    void movimentar_entradaDinheiro_somaGaveta() {
        CaixaSessao sessao = sessaoAbertaPadrao();
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        caixaService.movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.ENTRADA, new BigDecimal("50.00"), "DINHEIRO",
                "Baixa conta a receber", "Financeiro"));

        assertThat(sessao.getSaldoEsperado()).isEqualByComparingTo("250.00");
        assertThat(sessao.getTotalEntradas()).isEqualByComparingTo("50.00");
        assertThat(sessao.getTotalSaidas()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Baixa de título em cartão/PIX (RECEBIMENTO_FIADO): soma entradas sem tocar a gaveta")
    void movimentar_recebimentoFiado_soEntradas() {
        CaixaSessao sessao = sessaoAbertaPadrao();
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        caixaService.movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.RECEBIMENTO_FIADO, new BigDecimal("50.00"), "PIX",
                "Baixa conta a receber", "Financeiro"));

        assertThat(sessao.getSaldoEsperado()).isEqualByComparingTo("200.00");
        assertThat(sessao.getTotalEntradas()).isEqualByComparingTo("50.00");
    }

    @Test
    @DisplayName("Estorno de baixa em dinheiro (ESTORNO): subtrai da gaveta e soma saídas")
    void movimentar_estornoDinheiro_tiraDaGaveta() {
        CaixaSessao sessao = sessaoAbertaPadrao();
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        caixaService.movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.ESTORNO, new BigDecimal("50.00"), "DINHEIRO",
                "Estorno de baixa", "Financeiro"));

        assertThat(sessao.getSaldoEsperado()).isEqualByComparingTo("150.00");
        assertThat(sessao.getTotalSaidas()).isEqualByComparingTo("50.00");
        assertThat(sessao.getTotalEntradas()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("Estorno de baixa em cartão (ESTORNO): saída de papel, gaveta intacta")
    void movimentar_estornoNaoDinheiro_soSaidas() {
        CaixaSessao sessao = sessaoAbertaPadrao();
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        caixaService.movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.ESTORNO, new BigDecimal("50.00"), "CREDITO",
                "Estorno de baixa", "Financeiro"));

        assertThat(sessao.getSaldoEsperado()).isEqualByComparingTo("200.00");
        assertThat(sessao.getTotalSaidas()).isEqualByComparingTo("50.00");
    }

    @Test
    @DisplayName("Fechamento cego: deve gravar valor do sistema, diferença negativa e classificar QUEBRA")
    void deveFecharCaixaComDiferenca() {
        CaixaSessao sessao = CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .saldoInicial(new BigDecimal("100.00"))
                .saldoEsperado(new BigDecimal("100.00"))
                .totalEntradas(BigDecimal.ZERO)
                .totalSaidas(BigDecimal.ZERO)
                .movimentos(new ArrayList<>())
                .build();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenAnswer(inv -> inv.getArgument(0));

        FecharCaixaRequest req = new FecharCaixaRequest(
                new BigDecimal("98.00"),
                "Falta de R$ 2,00 no troco"
        );

        CaixaSessaoDTO dto = caixaService.fecharCaixa(lojaId, req);

        assertThat(dto.status()).isEqualTo(CaixaSessao.StatusCaixa.FECHADO);
        assertThat(dto.saldoInformadoFechamento()).isEqualByComparingTo("98.00");
        assertThat(dto.diferencaFechamento()).isEqualByComparingTo("-2.00");
        assertThat(dto.valorFechamentoSistema()).isEqualByComparingTo("100.00");
        assertThat(dto.classificacaoDiferenca()).isEqualTo("QUEBRA");
        verify(movimentoRepository).save(any(CaixaMovimento.class));
    }

    @Test
    @DisplayName("Fechamento cego: diferença positiva deve ser classificada como SOBRA")
    void deveClassificarSobraNoFechamento() {
        CaixaSessao sessao = CaixaSessao.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .saldoInicial(new BigDecimal("100.00"))
                .saldoEsperado(new BigDecimal("100.00"))
                .totalEntradas(BigDecimal.ZERO)
                .totalSaidas(BigDecimal.ZERO)
                .movimentos(new ArrayList<>())
                .build();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenAnswer(inv -> inv.getArgument(0));

        CaixaSessaoDTO dto = caixaService.fecharCaixa(lojaId,
                new FecharCaixaRequest(new BigDecimal("105.00"), "Sobra não identificada"));

        assertThat(dto.diferencaFechamento()).isEqualByComparingTo("5.00");
        assertThat(dto.classificacaoDiferenca()).isEqualTo("SOBRA");
    }

    @Test
    @DisplayName("Sangria deve exigir motivo (auditoria de gaveta)")
    void sangriaExigeMotivo() {
        SangriaSuprimentoRequest req = new SangriaSuprimentoRequest(
                new BigDecimal("50.00"), "   ", "DINHEIRO", "Operador");

        assertThatThrownBy(() -> caixaService.sangria(lojaId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Motivo da sangria é obrigatório");
    }

    @Test
    @DisplayName("Suprimento deve exigir motivo (auditoria de gaveta)")
    void suprimentoExigeMotivo() {
        SangriaSuprimentoRequest req = new SangriaSuprimentoRequest(
                new BigDecimal("50.00"), null, "DINHEIRO", "Operador");

        assertThatThrownBy(() -> caixaService.suprimento(lojaId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Motivo da suprimento é obrigatório");
    }

    @Test
    @DisplayName("Sangria deve exigir valor maior que zero")
    void sangriaExigeValorPositivo() {
        SangriaSuprimentoRequest req = new SangriaSuprimentoRequest(
                BigDecimal.ZERO, "Retirada", "DINHEIRO", "Operador");

        assertThatThrownBy(() -> caixaService.sangria(lojaId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("maior que zero");
    }

    @Test
    @DisplayName("Suprimento deve somar ao saldo esperado e gerar movimento auditado")
    void suprimentoSomaSaldoEGeraMovimento() {
        CaixaSessao sessao = sessaoAbertaPadrao();

        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));
        when(sessaoRepository.save(any(CaixaSessao.class))).thenReturn(sessao);

        SangriaSuprimentoRequest req = new SangriaSuprimentoRequest(
                new BigDecimal("300.00"), "Aporte do cofre para troco", "DINHEIRO", "Gerente");

        CaixaSessaoDTO dto = caixaService.suprimento(lojaId, req);

        assertThat(dto.saldoEsperado()).isEqualByComparingTo("500.00");
        assertThat(dto.totalEntradas()).isEqualByComparingTo("300.00");
        verify(movimentoRepository).save(argThat(m ->
                m.getTipo() == CaixaMovimento.TipoMovimento.SUPRIMENTO
                        && "Aporte do cofre para troco".equals(m.getMotivo())));
    }

    @Test
    @DisplayName("Sangria com valor acima do saldo deve ser bloqueada")
    void sangriaAcimaDoSalvoBloqueada() {
        CaixaSessao sessao = sessaoAbertaPadrao();
        when(sessaoRepository.findSessaoAbertaAtual(lojaId)).thenReturn(Optional.of(sessao));

        SangriaSuprimentoRequest req = new SangriaSuprimentoRequest(
                new BigDecimal("999.99"), "Sangria grande", "DINHEIRO", "Gerente");

        assertThatThrownBy(() -> caixaService.sangria(lojaId, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("excede o saldo disponível");
    }

    @Test
    @DisplayName("Extrato deve escopar por loja e sessão (R1) e devolver página")
    void extratoEscopadoPorLoja() {
        UUID sessaoId = UUID.randomUUID();
        CaixaMovimento mov = CaixaMovimento.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .tipo(CaixaMovimento.TipoMovimento.SANGRIA)
                .valor(new BigDecimal("10.00"))
                .formaPagamento("DINHEIRO")
                .motivo("Sangria teste")
                .criadoEm(OffsetDateTime.now())
                .build();

        when(sessaoRepository.findByIdAndLojaId(sessaoId, lojaId))
                .thenReturn(Optional.of(sessaoAbertaPadrao()));
        when(movimentoRepository.findBySessaoIdAndLojaId(eq(sessaoId), eq(lojaId), any()))
                .thenReturn(new PageImpl<>(List.of(mov)));

        Page<CaixaMovimentoDTO> pagina = caixaService.extrato(
                lojaId, sessaoId, null, PageRequest.of(0, 10));

        assertThat(pagina.getContent()).hasSize(1);
        assertThat(pagina.getContent().get(0).tipo()).isEqualTo(CaixaMovimento.TipoMovimento.SANGRIA);
        verify(sessaoRepository).findByIdAndLojaId(sessaoId, lojaId);
    }

    @Test
    @DisplayName("Extrato de sessão de outra loja deve falhar (R1)")
    void extratoDeOutraLojaFalha() {
        UUID sessaoId = UUID.randomUUID();
        when(sessaoRepository.findByIdAndLojaId(sessaoId, lojaId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> caixaService.extrato(
                lojaId, sessaoId, null, PageRequest.of(0, 10)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("não encontrada");
    }

    @Test
    @DisplayName("Relatório de fechamento deve montar resumo por modalidade vindo do banco (sem hard-code)")
    void relatorioFechamentoComResumoPorModalidade() {
        UUID sessaoId = UUID.randomUUID();
        CaixaSessao sessao = sessaoAbertaPadrao();
        sessao.setId(sessaoId);

        FormaPagamento dinheiro = FormaPagamento.builder()
                .id(UUID.randomUUID()).nome("Dinheiro")
                .tipo(FormaPagamento.TipoFormaPagamento.DINHEIRO).build();
        FormaPagamento pix = FormaPagamento.builder()
                .id(UUID.randomUUID()).nome("PIX")
                .tipo(FormaPagamento.TipoFormaPagamento.PIX).build();

        CaixaMovimento sangriaMov = CaixaMovimento.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .tipo(CaixaMovimento.TipoMovimento.SANGRIA)
                .valor(new BigDecimal("20.00"))
                .motivo("Sangria cofre")
                .criadoEm(OffsetDateTime.now())
                .build();

        when(sessaoRepository.findByIdAndLojaId(sessaoId, lojaId)).thenReturn(Optional.of(sessao));
        when(movimentoRepository.findBySessaoIdAndLojaIdOrderByCriadoEmAsc(sessaoId, lojaId))
                .thenReturn(List.of(sangriaMov));
        when(formaPagamentoRepository.findByLojaIdAndAtivoTrue(lojaId))
                .thenReturn(List.of(dinheiro, pix));
        when(pagamentoRepository.somarPorFormaPagamentoNoPeriodo(eq(lojaId), any(), any(), eq(StatusOS.CANCELADO)))
                .thenReturn(List.of(
                        new Object[]{pix.getId(), "PIX", new BigDecimal("300.00")},
                        new Object[]{dinheiro.getId(), "Dinheiro", new BigDecimal("80.00")}));

        RelatorioFechamentoDTO rel = caixaService.relatorioFechamento(lojaId, sessaoId);

        assertThat(rel.sessaoId()).isEqualTo(sessaoId);
        assertThat(rel.totalSangrias()).isEqualByComparingTo("20.00");
        assertThat(rel.totalVendas()).isEqualByComparingTo("380.00");
        assertThat(rel.resumoPorModalidade()).hasSize(2);
        assertThat(rel.resumoPorModalidade().stream()
                .filter(r -> "PIX".equals(r.nome())).findFirst().orElseThrow()
                .total()).isEqualByComparingTo("300.00");
        assertThat(rel.resumoPorModalidade().stream()
                .filter(r -> "Dinheiro".equals(r.nome())).findFirst().orElseThrow()
                .total()).isEqualByComparingTo("80.00");
        assertThat(rel.classificacaoDiferenca()).isNull();
        assertThat(rel.movimentos()).hasSize(1);
    }
}
