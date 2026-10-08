package com.visionbox.modules.relatorios.service;

import com.visionbox.modules.relatorios.dto.CurvaAbcResponse;
import com.visionbox.modules.relatorios.dto.GiroProdutoResponse;
import com.visionbox.modules.relatorios.dto.MargemVendedorResponse;
import com.visionbox.modules.relatorios.repository.AbcProdutoProjection;
import com.visionbox.modules.relatorios.repository.GiroProdutoProjection;
import com.visionbox.modules.relatorios.repository.MargemOsProjection;
import com.visionbox.modules.relatorios.repository.RelatorioBiRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RelatorioBiServiceTest {

    private static final UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private RelatorioBiRepository repository;
    private RelatorioBiService service;

    @BeforeEach
    void setUp() {
        repository = mock(RelatorioBiRepository.class);
        service = new RelatorioBiService(repository);
        TenantContext.setCurrentLojaId(LOJA);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ===== período =====

    @Test
    void periodoInvalido_dataFimAntesDeDataInicio_lancaIllegalArgument() {
        LocalDate inicio = LocalDate.of(2026, 10, 1);
        LocalDate fim = LocalDate.of(2026, 9, 1);

        assertThatThrownBy(() -> service.giroProdutos(inicio, fim, PageRequest.of(0, 20)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dataFim deve ser >= dataInicio");
        assertThatThrownBy(() -> service.margemVendedor(inicio, fim, PageRequest.of(0, 20)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.curvaAbc(inicio, fim))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void giroProdutos_semPeriodo_usaMesAtualEDefaultLojaDoTenantContext() {
        PageRequest page = PageRequest.of(0, 20);
        GiroProdutoProjection proj = giro("Armação Ray-Ban", "ARM-001", 3L, "60.00");
        when(repository.rankingGiro(any(), any(), any(), any())).thenReturn(new org.springframework.data.domain.PageImpl<>(
                List.of(proj), page, 1));

        service.giroProdutos(null, null, page);

        OffsetDateTime inicioEsperado = LocalDate.now().withDayOfMonth(1)
                .atStartOfDay(RelatorioBiService.ZONE_BI).toOffsetDateTime();
        OffsetDateTime fimEsperado = LocalDate.now().plusDays(1)
                .atStartOfDay(RelatorioBiService.ZONE_BI).toOffsetDateTime();
        verify(repository).rankingGiro(eq(LOJA), eq(inicioEsperado), eq(fimEsperado), eq(page));
    }

    @Test
    void periodoComDatasExplicitas_converteParaIntervaloExclusivoEmSaoPaulo() {
        LocalDate inicio = LocalDate.of(2026, 9, 1);
        LocalDate fim = LocalDate.of(2026, 9, 30);

        service.curvaAbc(inicio, fim);

        OffsetDateTime inicioEsperado = inicio.atStartOfDay(RelatorioBiService.ZONE_BI).toOffsetDateTime();
        OffsetDateTime fimEsperado = LocalDate.of(2026, 10, 1)
                .atStartOfDay(RelatorioBiService.ZONE_BI).toOffsetDateTime();
        verify(repository).faturamentoPorProduto(eq(LOJA), eq(inicioEsperado), eq(fimEsperado));
    }

    // ===== giro =====

    @Test
    void giroProdutos_mapeiaProjecaoParaResponse() {
        PageRequest page = PageRequest.of(0, 20);
        GiroProdutoProjection proj = giro("Armação Ray-Ban", "ARM-001", 3L, "60.00");
        when(repository.rankingGiro(any(), any(), any(), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(proj), page, 1));

        Page<GiroProdutoResponse> result = service.giroProdutos(null, null, page);

        assertThat(result.getTotalElements()).isEqualTo(1);
        GiroProdutoResponse item = result.getContent().get(0);
        assertThat(item.getProdutoNome()).isEqualTo("Armação Ray-Ban");
        assertThat(item.getSku()).isEqualTo("ARM-001");
        assertThat(item.getQuantidadeVendida()).isEqualTo(3L);
        assertThat(item.getFaturamento()).isEqualByComparingTo("60.00");
        assertThat(item.getTipoProduto()).isEqualTo("ARMACAO");
    }

    // ===== margem =====

    @Test
    void margemVendedor_agregaLinhasPorOsDoRepositorio() {
        PageRequest page = PageRequest.of(0, 20);
        MargemOsProjection m1 = margemOs("Maria", "100.00", "40.00");
        MargemOsProjection m2 = margemOs("Maria", "50.00", "10.00");
        when(repository.dadosMargemPorOs(any(), any(), any()))
                .thenReturn(List.of(m1, m2));

        Page<MargemVendedorResponse> result = service.margemVendedor(null, null, page);

        verify(repository).dadosMargemPorOs(eq(LOJA), any(), any());
        assertThat(result.getContent()).hasSize(1);
        MargemVendedorResponse maria = result.getContent().get(0);
        assertThat(maria.getTotalOs()).isEqualTo(2);
        assertThat(maria.getReceita()).isEqualByComparingTo("150.00");
        assertThat(maria.getCusto()).isEqualByComparingTo("50.00");
        assertThat(maria.getMargem()).isEqualByComparingTo("100.00");
    }

    @Test
    void margemVendedor_paginaListaAgregadaEmMemoria() {
        MargemOsProjection a = margemOs("A", "100.00", "0.00");
        MargemOsProjection b = margemOs("B", "100.00", "10.00");
        MargemOsProjection c = margemOs("C", "100.00", "20.00");
        when(repository.dadosMargemPorOs(any(), any(), any()))
                .thenReturn(List.of(a, b, c));

        PageRequest page = PageRequest.of(1, 2); // 2ª página, size 2
        Page<MargemVendedorResponse> result = service.margemVendedor(null, null, page);

        assertThat(result.getTotalElements()).isEqualTo(3);
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getVendedor()).isEqualTo("C");
    }

    // ===== curva ABC =====

    @Test
    void curvaAbc_classificaItensESomaTotalDoPeriodo() {
        AbcProdutoProjection p1 = abc("Armação A", "80.00");
        AbcProdutoProjection p2 = abc("Lente B", "15.00");
        AbcProdutoProjection p3 = abc("Armação C", "5.00");
        when(repository.faturamentoPorProduto(any(), any(), any()))
                .thenReturn(List.of(p1, p2, p3));

        CurvaAbcResponse result = service.curvaAbc(null, null);

        verify(repository).faturamentoPorProduto(eq(LOJA), any(), any());
        assertThat(result.getTotalFaturamento()).isEqualByComparingTo("100.00");
        assertThat(result.getTotalProdutos()).isEqualTo(3);
        assertThat(result.getItens()).extracting(com.visionbox.modules.relatorios.dto.CurvaAbcItemResponse::getClasse)
                .containsExactly("A", "B", "C");
        assertThat(result.getItens().get(0).getPercentualAcumulado()).isEqualByComparingTo("80.00");
    }

    // ===== helpers de mock =====

    private GiroProdutoProjection giro(String nome, String sku, Long qtd, String faturamento) {
        GiroProdutoProjection m = mock(GiroProdutoProjection.class);
        when(m.getProdutoId()).thenReturn(UUID.randomUUID());
        when(m.getProdutoNome()).thenReturn(nome);
        when(m.getSku()).thenReturn(sku);
        when(m.getTipoProduto()).thenReturn("ARMACAO");
        when(m.getQuantidadeVendida()).thenReturn(qtd);
        when(m.getFaturamento()).thenReturn(new BigDecimal(faturamento));
        return m;
    }

    private MargemOsProjection margemOs(String vendedor, String receita, String custo) {
        MargemOsProjection m = mock(MargemOsProjection.class);
        when(m.getOsId()).thenReturn(UUID.randomUUID());
        when(m.getVendedor()).thenReturn(vendedor);
        when(m.getReceita()).thenReturn(new BigDecimal(receita));
        when(m.getCusto()).thenReturn(new BigDecimal(custo));
        return m;
    }

    private AbcProdutoProjection abc(String nome, String faturamento) {
        AbcProdutoProjection m = mock(AbcProdutoProjection.class);
        when(m.getProdutoId()).thenReturn(UUID.randomUUID());
        when(m.getProdutoNome()).thenReturn(nome);
        when(m.getSku()).thenReturn("SKU-" + nome);
        when(m.getFaturamento()).thenReturn(new BigDecimal(faturamento));
        return m;
    }
}