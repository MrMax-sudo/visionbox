package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.dto.FinanceiroTotaisResponse;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberPagamentoRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Métricas agregadas do hub Financeiro (§3.3, V41) — GET /financeiro/totais.
 * Pontos cobertos: agregação das somas dos repositórios (SUM no banco, valor EM
 * ABERTO — semântica do título parcialmente pago é garantida pelas queries do
 * repositório: sum(valor_aberto) / sum(valor - valor_pago)), vencidos fixos em
 * "hoje" (independem do período), janela semiaberta de data_pagamento para o
 * total recebido, default de mês corrente sem datas e escala monetária 2 casas.
 */
class FinanceiroTotaisServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final LocalDate INICIO = LocalDate.of(2026, 10, 1);
    private static final LocalDate FIM = LocalDate.of(2026, 10, 31);

    private ContaReceberRepository contaReceberRepository;
    private ContaPagarRepository contaPagarRepository;
    private ContaReceberPagamentoRepository pagamentoRepository;
    private FinanceiroTotaisService service;

    @BeforeEach
    void setUp() {
        contaReceberRepository = mock(ContaReceberRepository.class);
        contaPagarRepository = mock(ContaPagarRepository.class);
        pagamentoRepository = mock(ContaReceberPagamentoRepository.class);
        service = new FinanceiroTotaisService(contaReceberRepository, contaPagarRepository, pagamentoRepository);
        TenantContext.setCurrentLojaId(LOJA);

        // default neutro: sem títulos no período
        when(contaReceberRepository.sumValorAbertoByLojaIdAndVencimentoBetween(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(contaPagarRepository.sumSaldoAbertoByLojaIdAndVencimentoBetween(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(contaReceberRepository.sumValorAbertoVencidosAte(any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(contaPagarRepository.sumSaldoAbertoVencidosAte(any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(pagamentoRepository.sumValorPagoByLojaIdAndPeriodo(any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void totais_periodoExplicito_agregaSomasDosRepositorios_comSaldoProjetado() {
        when(contaReceberRepository.sumValorAbertoByLojaIdAndVencimentoBetween(LOJA, INICIO, FIM))
                .thenReturn(new BigDecimal("1500.00"));
        when(contaPagarRepository.sumSaldoAbertoByLojaIdAndVencimentoBetween(LOJA, INICIO, FIM))
                .thenReturn(new BigDecimal("800.00"));
        when(contaReceberRepository.sumValorAbertoVencidosAte(eq(LOJA), any()))
                .thenReturn(new BigDecimal("150.00"));
        when(contaPagarRepository.sumSaldoAbertoVencidosAte(eq(LOJA), any()))
                .thenReturn(new BigDecimal("50.00"));
        when(pagamentoRepository.sumValorPagoByLojaIdAndPeriodo(eq(LOJA), any(), any()))
                .thenReturn(new BigDecimal("950.00"));

        FinanceiroTotaisResponse resp = service.totais(INICIO, FIM);

        assertThat(resp.getTotalAReceberPeriodo()).isEqualByComparingTo("1500.00");
        assertThat(resp.getTotalAPagarPeriodo()).isEqualByComparingTo("800.00");
        // vencidos = a receber + a pagar (mesmo significado do card "Títulos vencidos hoje")
        assertThat(resp.getTitulosVencidosAteHoje()).isEqualByComparingTo("200.00");
        // saldo projetado = a receber − a pagar
        assertThat(resp.getSaldoProjetado()).isEqualByComparingTo("700.00");
        assertThat(resp.getTotalRecebidoPeriodo()).isEqualByComparingTo("950.00");

        // período (vencimento) repassado 1:1 aos SUMs
        verify(contaReceberRepository).sumValorAbertoByLojaIdAndVencimentoBetween(LOJA, INICIO, FIM);
        verify(contaPagarRepository).sumSaldoAbertoByLojaIdAndVencimentoBetween(LOJA, INICIO, FIM);
    }

    @Test
    void totais_recebidoNoPeriodo_janelaSemiabertaDeUmDiaAposOFim() {
        service.totais(INICIO, FIM);

        ArgumentCaptor<OffsetDateTime> capInicio = ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> capFim = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(pagamentoRepository).sumValorPagoByLojaIdAndPeriodo(eq(LOJA), capInicio.capture(), capFim.capture());
        assertThat(capInicio.getValue())
                .isEqualTo(INICIO.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime());
        // fim+1 00:00 (exclusivo) → baixas do próprio dia FIM contam no período
        assertThat(capFim.getValue())
                .isEqualTo(FIM.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime());
    }

    @Test
    void totais_vencidosConsideraDataDeHoje_naoOPeriodoFiltrado() {
        service.totais(INICIO, FIM);

        LocalDate hoje = LocalDate.now();
        verify(contaReceberRepository).sumValorAbertoVencidosAte(LOJA, hoje);
        verify(contaPagarRepository).sumSaldoAbertoVencidosAte(LOJA, hoje);
    }

    @Test
    void totais_semDatas_defaultMesCorrente() {
        service.totais(null, null);

        LocalDate hoje = LocalDate.now();
        verify(contaReceberRepository)
                .sumValorAbertoByLojaIdAndVencimentoBetween(LOJA, hoje.withDayOfMonth(1), hoje.withDayOfMonth(hoje.lengthOfMonth()));
    }

    @Test
    void totais_normalizaEscalaDuasCasas() {
        when(contaReceberRepository.sumValorAbertoByLojaIdAndVencimentoBetween(any(), any(), any()))
                .thenReturn(new BigDecimal("1500.5000"));

        FinanceiroTotaisResponse resp = service.totais(INICIO, FIM);

        assertThat(resp.getTotalAReceberPeriodo()).isEqualByComparingTo("1500.50");
        assertThat(resp.getTotalAReceberPeriodo().scale()).isEqualTo(2);
        assertThat(resp.getSaldoProjetado().scale()).isEqualTo(2);
    }

    @Test
    void totais_semTenant_falhaAntesDeQualquerQuery() {
        TenantContext.clear();

        assertThatThrownBy(() -> service.totais(INICIO, FIM))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Tenant");
        verifyNoInteractions(contaReceberRepository);
        verifyNoInteractions(contaPagarRepository);
        verifyNoInteractions(pagamentoRepository);
    }
}
