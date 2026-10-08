package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.dto.DREResponse;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * DREServiceTest — US13: DRE por loja (período), DRE por OS, comissão por taxa,
 * exclusão de cancelados, tenant obrigatório e contrato legado preservado.
 */
class DREServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private ContaReceberRepository contaReceberRepository;
    private ContaPagarRepository contaPagarRepository;
    private DREService service;

    @BeforeEach
    void setUp() {
        contaReceberRepository = mock(ContaReceberRepository.class);
        contaPagarRepository = mock(ContaPagarRepository.class);
        service = new DREService(contaReceberRepository, contaPagarRepository);
        TenantContext.setCurrentLojaId(LOJA);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void drePorLoja_somaReceitaCustoComissaoEResultado() {
        LocalDate ini = LocalDate.of(2026, 10, 1);
        LocalDate fim = LocalDate.of(2026, 10, 31);
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(LOJA, ini, fim))
                .thenReturn(List.of(
                        cr("100.00", ContaReceber.StatusConta.PAGO),
                        cr("50.00", ContaReceber.StatusConta.PENDENTE),
                        cr("30.00", ContaReceber.StatusConta.CANCELADO)));
        when(contaPagarRepository.findByLojaIdAndVencimentoBetween(LOJA, ini, fim))
                .thenReturn(List.of(
                        cp("40.00", ContaPagar.StatusContaPagar.PAGO),
                        cp("10.00", ContaPagar.StatusContaPagar.CANCELADO)));

        DREResponse r = service.calcular(ini, fim, null);

        assertThat(r.getLojaId()).isEqualTo(LOJA);
        assertThat(r.getReceita()).isEqualByComparingTo("150.00"); // 100+50 (canc. fora)
        assertThat(r.getCusto()).isEqualByComparingTo("40.00");    // canc. fora
        assertThat(r.getComissao()).isEqualByComparingTo("7.50");  // 150 * 5%
        assertThat(r.getDre()).isEqualByComparingTo("102.50");     // 150-40-7.50
        assertThat(r.getMargemPercentual()).isEqualByComparingTo("68.33");
        assertThat(r.getTotalContasReceber()).isEqualTo(2);
        assertThat(r.getTotalContasPagar()).isEqualTo(1);
        assertThat(r.getOsId()).isNull();
        assertThat(r.getPeriodo()).isNull();
    }

    @Test
    void drePorOS_filtraReceitaECustoPelaOrdemServico() {
        UUID osId = UUID.randomUUID();
        LocalDate ini = LocalDate.of(2026, 10, 1);
        LocalDate fim = LocalDate.of(2026, 10, 31);
        when(contaReceberRepository.findByLojaIdAndOrdemServicoIdAndVencimentoBetween(LOJA, osId, ini, fim))
                .thenReturn(List.of(cr("200.00", ContaReceber.StatusConta.PAGO)));
        when(contaPagarRepository.findByLojaIdAndOrdemServicoIdAndVencimentoBetween(LOJA, osId, ini, fim))
                .thenReturn(List.of(cp("80.00", ContaPagar.StatusContaPagar.PAGO)));

        DREResponse r = service.calcular(null, osId, ini, fim, null, null);

        assertThat(r.getOsId()).isEqualTo(osId);
        assertThat(r.getReceita()).isEqualByComparingTo("200.00");
        assertThat(r.getCusto()).isEqualByComparingTo("80.00");
        assertThat(r.getComissao()).isEqualByComparingTo("10.00"); // 200 * 5%
        assertThat(r.getDre()).isEqualByComparingTo("110.00");
        // contrato: queries por OS, nunca as da loja (nunca vaza outra OS/loja)
        verify(contaReceberRepository, never()).findByLojaIdAndVencimentoBetween(any(), any(), any());
        verify(contaPagarRepository, never()).findByLojaIdAndVencimentoBetween(any(), any(), any());
    }

    @Test
    void drePorOS_semPeriodo_usaTodaAOsERespondeSemDatas() {
        UUID osId = UUID.randomUUID();
        when(contaReceberRepository.findByLojaIdAndOrdemServicoIdAndVencimentoBetween(
                LOJA, osId, LocalDate.of(1900, 1, 1), LocalDate.of(2999, 12, 31)))
                .thenReturn(List.of());
        when(contaPagarRepository.findByLojaIdAndOrdemServicoIdAndVencimentoBetween(
                LOJA, osId, LocalDate.of(1900, 1, 1), LocalDate.of(2999, 12, 31)))
                .thenReturn(List.of());

        DREResponse r = service.calcular(null, osId, null, null, null, null);

        assertThat(r.getOsId()).isEqualTo(osId);
        assertThat(r.getInicio()).isNull();
        assertThat(r.getFim()).isNull();
        assertThat(r.getReceita()).isEqualByComparingTo("0.00");
    }

    @Test
    void drePeriodoMes_usaIntervaloDoMes() {
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(
                LOJA, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31)))
                .thenReturn(List.of());
        when(contaPagarRepository.findByLojaIdAndVencimentoBetween(
                LOJA, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31)))
                .thenReturn(List.of());

        DREResponse r = service.calcular(null, null, null, null, null, "2026-10");

        assertThat(r.getPeriodo()).isEqualTo("2026-10");
        assertThat(r.getInicio()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(r.getFim()).isEqualTo(LocalDate.of(2026, 10, 31));
    }

    @Test
    void drePeriodoIntervalo_usaBoundariesInformados() {
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(
                LOJA, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31)))
                .thenReturn(List.of(cr("10.00", ContaReceber.StatusConta.PAGO)));
        when(contaPagarRepository.findByLojaIdAndVencimentoBetween(
                LOJA, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31)))
                .thenReturn(List.of());

        DREResponse r = service.calcular(null, null, null, null, null, "2026-01-01..2026-03-31");

        assertThat(r.getPeriodo()).isEqualTo("2026-01-01..2026-03-31");
        assertThat(r.getReceita()).isEqualByComparingTo("10.00");
    }

    @Test
    void lojaIdDivergenteDoTenant_lancaErro() {
        UUID outra = UUID.fromString("00000000-0000-0000-0000-000000000002");
        assertThatThrownBy(() -> service.calcular(outra, null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("diverge do tenant");
    }

    @Test
    void periodoComInicioFim_lancaErro() {
        assertThatThrownBy(() -> service.calcular(null, null, LocalDate.of(2026, 10, 1), null, null, "2026-10"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("OU");
    }

    @Test
    void periodoInvalido_lancaErro() {
        assertThatThrownBy(() -> service.calcular(null, null, null, null, null, "2026-13"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("periodo inválido");
    }

    @Test
    void taxaComissaoIntegral_normalizaParaPercentual() {
        LocalDate ini = LocalDate.of(2026, 10, 1);
        LocalDate fim = LocalDate.of(2026, 10, 31);
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(LOJA, ini, fim))
                .thenReturn(List.of(cr("200.00", ContaReceber.StatusConta.PAGO)));
        when(contaPagarRepository.findByLojaIdAndVencimentoBetween(LOJA, ini, fim))
                .thenReturn(List.of());

        DREResponse r = service.calcular(ini, fim, new BigDecimal("5"));

        // 5 = 5% => comissão 10.00
        assertThat(r.getComissao()).isEqualByComparingTo("10.00");
        assertThat(r.getDre()).isEqualByComparingTo("190.00");
    }

    @Test
    void comissaoExtraDeFornecedorComissao_usadaQuandoTaxaZero() {
        LocalDate ini = LocalDate.of(2026, 10, 1);
        LocalDate fim = LocalDate.of(2026, 10, 31);
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(LOJA, ini, fim))
                .thenReturn(List.of(cr("100.00", ContaReceber.StatusConta.PAGO)));
        when(contaPagarRepository.findByLojaIdAndVencimentoBetween(LOJA, ini, fim))
                .thenReturn(List.of(cp("7.00", ContaPagar.StatusContaPagar.PAGO, "COMISSAO DA LOJA")));

        DREResponse r = service.calcular(ini, fim, BigDecimal.ZERO);

        assertThat(r.getComissao()).isEqualByComparingTo("7.00");
    }

    @Test
    void contratoLegado_semParametros_usaMesAtual() {
        // sem inicio/fim/periodo => default mês atual (contrato preservado)
        LocalDate hoje = LocalDate.now();
        LocalDate iniEsperado = hoje.withDayOfMonth(1);
        when(contaReceberRepository.findByLojaIdAndVencimentoBetween(LOJA, iniEsperado, hoje))
                .thenReturn(List.of());
        when(contaPagarRepository.findByLojaIdAndVencimentoBetween(LOJA, iniEsperado, hoje))
                .thenReturn(List.of());

        DREResponse r = service.calcular(null, null, null, null, null, null);

        assertThat(r.getInicio()).isEqualTo(iniEsperado);
        assertThat(r.getFim()).isEqualTo(hoje);
        verify(contaReceberRepository).findByLojaIdAndVencimentoBetween(LOJA, iniEsperado, hoje);
    }

    @Test
    void fimAntesDeInicio_lancaErro() {
        assertThatThrownBy(() -> service.calcular(LocalDate.of(2026, 10, 31), LocalDate.of(2026, 10, 1), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fim deve ser >= inicio");
    }

    private ContaReceber cr(String valor, ContaReceber.StatusConta status) {
        return ContaReceber.builder()
                .lojaId(LOJA)
                .valor(new BigDecimal(valor))
                .valorPago(BigDecimal.ZERO.setScale(2))
                .vencimento(LocalDate.of(2026, 10, 15))
                .status(status)
                .build();
    }

    private ContaPagar cp(String valor, ContaPagar.StatusContaPagar status) {
        return cp(valor, status, "Fornecedor Lab");
    }

    private ContaPagar cp(String valor, ContaPagar.StatusContaPagar status, String fornecedor) {
        return ContaPagar.builder()
                .lojaId(LOJA)
                .fornecedor(fornecedor)
                .valor(new BigDecimal(valor))
                .valorPago(BigDecimal.ZERO.setScale(2))
                .vencimento(LocalDate.of(2026, 10, 20))
                .status(status)
                .build();
    }
}