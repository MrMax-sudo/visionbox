package com.visionbox.modules.relatorios.service;

import com.visionbox.modules.relatorios.dto.MargemVendedorResponse;
import com.visionbox.modules.relatorios.repository.MargemOsProjection;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MargemVendedorAggregator — regra de cálculo da margem por vendedor (US16).
 * <p>
 * Entrada: linhas por OS ({@link MargemOsProjection}, com vendedor, receita e
 * custo já resolvidos no SQL). Saída: agregação por vendedor —
 * <ul>
 *   <li>receita = Σ receita das OS</li>
 *   <li>custo = Σ custo das OS</li>
 *   <li>margem = receita − custo (HALF_EVEN 2 casas)</li>
 *   <li>margemPercentual = margem / receita × 100 (0 quando receita = 0)</li>
 *   <li>vendedor nulo/blank vira "sistema" (não agrega em linha nula)</li>
 * </ul>
 * Ordenação: margem desc; desempate pelo nome do vendedor (case-insensitive).
 * Classe pura — nenhuma dependência de Spring/JPA, testável unitariamente.
 */
public final class MargemVendedorAggregator {

    public static final String VENDEDOR_SISTEMA = "sistema";

    private MargemVendedorAggregator() {
    }

    public static List<MargemVendedorResponse> agregar(List<MargemOsProjection> linhasOs) {
        if (linhasOs == null || linhasOs.isEmpty()) {
            return List.of();
        }
        Map<String, Acumulador> porVendedor = new HashMap<>();
        for (MargemOsProjection linha : linhasOs) {
            String vendedor = linha.getVendedor() == null || linha.getVendedor().isBlank()
                    ? VENDEDOR_SISTEMA
                    : linha.getVendedor().trim();
            Acumulador acc = porVendedor.computeIfAbsent(vendedor, k -> new Acumulador());
            acc.totalOs++;
            acc.receita = acc.receita.add(ValoresBi.dinheiro(linha.getReceita()));
            acc.custo = acc.custo.add(ValoresBi.dinheiro(linha.getCusto()));
        }
        return porVendedor.entrySet().stream()
                .map(e -> montar(e.getKey(), e.getValue()))
                .sorted(Comparator
                        .comparing(MargemVendedorResponse::getMargem).reversed()
                        .thenComparing(MargemVendedorResponse::getVendedor, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static MargemVendedorResponse montar(String vendedor, Acumulador acc) {
        BigDecimal receita = acc.receita.setScale(2, java.math.RoundingMode.HALF_EVEN);
        BigDecimal custo = acc.custo.setScale(2, java.math.RoundingMode.HALF_EVEN);
        BigDecimal margem = receita.subtract(custo).setScale(2, java.math.RoundingMode.HALF_EVEN);
        return MargemVendedorResponse.builder()
                .vendedor(vendedor)
                .totalOs(acc.totalOs)
                .receita(receita)
                .custo(custo)
                .margem(margem)
                .margemPercentual(ValoresBi.percentual(margem, receita))
                .build();
    }

    private static final class Acumulador {
        private long totalOs;
        private BigDecimal receita = BigDecimal.ZERO;
        private BigDecimal custo = BigDecimal.ZERO;
    }
}