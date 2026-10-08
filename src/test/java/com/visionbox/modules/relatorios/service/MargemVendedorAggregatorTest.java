package com.visionbox.modules.relatorios.service;

import com.visionbox.modules.relatorios.dto.MargemVendedorResponse;
import com.visionbox.modules.relatorios.repository.MargemOsProjection;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MargemVendedorAggregatorTest {

    private static final UUID OS_A = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID OS_B = UUID.fromString("00000000-0000-0000-0000-000000000002");

    @Test
    void agregar_somaReceitaCustoEContaOsDoMesmoVendedor() {
        List<MargemOsProjection> linhas = List.of(
                linha(OS_A, "Maria", "100.00", "40.00"),
                linha(OS_B, "Maria", "50.00", "10.00"));

        List<MargemVendedorResponse> result = MargemVendedorAggregator.agregar(linhas);

        assertThat(result).hasSize(1);
        MargemVendedorResponse maria = result.get(0);
        assertThat(maria.getVendedor()).isEqualTo("Maria");
        assertThat(maria.getTotalOs()).isEqualTo(2);
        assertThat(maria.getReceita()).isEqualByComparingTo("150.00");
        assertThat(maria.getCusto()).isEqualByComparingTo("50.00");
        assertThat(maria.getMargem()).isEqualByComparingTo("100.00");
        assertThat(maria.getMargemPercentual()).isEqualByComparingTo("66.67");
    }

    @Test
    void agregar_calculaMargemPercentualHalEven() {
        // receita 30, custo 20 -> margem 10 -> 33.333... -> 33.33
        List<MargemVendedorResponse> result = MargemVendedorAggregator.agregar(List.of(linha(OS_A, "Joao", "30.00", "20.00")));

        assertThat(result.get(0).getMargem()).isEqualByComparingTo("10.00");
        assertThat(result.get(0).getMargemPercentual()).isEqualByComparingTo("33.33");
    }

    @Test
    void agregar_margemNegativaPermitidaEpercentualZeroQuandoReceitaZero() {
        // receita 0, custo 10 -> margem -10, margem% = 0 (evita divisão por zero)
        List<MargemVendedorResponse> result = MargemVendedorAggregator.agregar(List.of(linha(OS_A, "Joao", "0.00", "10.00")));

        assertThat(result.get(0).getMargem()).isEqualByComparingTo("-10.00");
        assertThat(result.get(0).getMargemPercentual()).isEqualByComparingTo("0.00");
    }

    @Test
    void agregar_vendedorNuloOuBlankViraSistema() {
        List<MargemVendedorResponse> result = MargemVendedorAggregator.agregar(List.of(
                linha(OS_A, null, "100.00", "40.00"),
                linha(OS_B, "  ", "30.00", "10.00")));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getVendedor()).isEqualTo(MargemVendedorAggregator.VENDEDOR_SISTEMA);
        assertThat(result.get(0).getTotalOs()).isEqualTo(2);
        assertThat(result.get(0).getReceita()).isEqualByComparingTo("130.00");
    }

    @Test
    void agregar_ordenaPorMargemDesc() {
        List<MargemVendedorResponse> result = MargemVendedorAggregator.agregar(List.of(
                linha(OS_A, "Baixa", "100.00", "95.00"),   // margem 5
                linha(OS_B, "Alta", "100.00", "50.00")));  // margem 50

        assertThat(result).extracting(MargemVendedorResponse::getVendedor)
                .containsExactly("Alta", "Baixa");
        assertThat(result).extracting(MargemVendedorResponse::getMargem)
                .extracting(m -> m.compareTo(new BigDecimal("50.00")))
                .containsExactly(0, -1); // 50 > 5
    }

    @Test
    void agregar_mesmoVendedorComCasoDiferenteEhLinhaSeparada() {
        List<MargemVendedorResponse> result = MargemVendedorAggregator.agregar(List.of(
                linha(OS_A, "Maria", "100.00", "40.00"),
                linha(OS_B, "maria", "50.00", "10.00")));

        assertThat(result).hasSize(2);
    }

    @Test
    void agregar_listaVazia_retornaVazio() {
        assertThat(MargemVendedorAggregator.agregar(List.of())).isEmpty();
        assertThat(MargemVendedorAggregator.agregar(null)).isEmpty();
    }

    private MargemOsProjection linha(UUID osId, String vendedor, String receita, String custo) {
        MargemOsProjection m = mock(MargemOsProjection.class);
        when(m.getOsId()).thenReturn(osId);
        when(m.getVendedor()).thenReturn(vendedor);
        when(m.getReceita()).thenReturn(new BigDecimal(receita));
        when(m.getCusto()).thenReturn(new BigDecimal(custo));
        return m;
    }
}