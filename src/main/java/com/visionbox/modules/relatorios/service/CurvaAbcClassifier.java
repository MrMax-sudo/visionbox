package com.visionbox.modules.relatorios.service;

import com.visionbox.modules.relatorios.dto.CurvaAbcItemResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * CurvaAbcClassifier — classificação ABC de produtos por faturamento (US16).
 * <p>
 * Regras (ADR-006 D3):
 * <ol>
 *   <li>Ordena por faturamento desc; desempate por nome (case-insensitive).</li>
 *   <li>Participação = faturamento do item / faturamento total × 100.</li>
 *   <li>Percentual acumulado = soma corrente exata; exibido com 2 casas.</li>
 *   <li>Faixa decidida sobre o acumulado EXATO (10 casas intermediárias):
 *       ≤ 80% → A &nbsp; ≤ 95% → B &nbsp; caso contrário → C.</li>
 *   <li>Sem faturamento no período → todos classe C com participação 0
 *       (nada a rankear, sem divisão por zero).</li>
 * </ol>
 * Classe pura — nenhuma dependência de Spring/JPA, testável unitariamente.
 */
public final class CurvaAbcClassifier {

    private static final int PRECISAO_INTERMEDIARIA = 10;

    private CurvaAbcClassifier() {
    }

    public static List<CurvaAbcItemResponse> classificar(List<AbcProduto> produtos) {
        if (produtos == null || produtos.isEmpty()) {
            return List.of();
        }
        List<AbcProduto> ordenados = produtos.stream()
                .sorted(Comparator
                        .comparing(AbcProduto::faturamento).reversed()
                        .thenComparing(AbcProduto::produtoNome, String.CASE_INSENSITIVE_ORDER))
                .toList();

        BigDecimal total = ordenados.stream()
                .map(AbcProduto::faturamento)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean semFaturamento = total.compareTo(BigDecimal.ZERO) == 0;
        BigDecimal limiteA = total
                .multiply(new BigDecimal("80"))
                .divide(new BigDecimal("100"), PRECISAO_INTERMEDIARIA, RoundingMode.HALF_EVEN);
        BigDecimal limiteB = total
                .multiply(new BigDecimal("95"))
                .divide(new BigDecimal("100"), PRECISAO_INTERMEDIARIA, RoundingMode.HALF_EVEN);

        BigDecimal acumuladoExato = BigDecimal.ZERO.setScale(PRECISAO_INTERMEDIARIA, RoundingMode.HALF_EVEN);
        List<CurvaAbcItemResponse> resultado = new ArrayList<>(ordenados.size());

        for (AbcProduto produto : ordenados) {
            BigDecimal parte = ValoresBi.dinheiro(produto.faturamento());
            if (!semFaturamento) {
                acumuladoExato = acumuladoExato.add(parte);
            }
            BigDecimal participacao = semFaturamento
                    ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN)
                    : parte.multiply(new BigDecimal("100"))
                            .divide(total, PRECISAO_INTERMEDIARIA, RoundingMode.HALF_EVEN)
                            .setScale(2, RoundingMode.HALF_EVEN);
            BigDecimal acumuladoExibicao = semFaturamento
                    ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN)
                    : acumuladoExato.multiply(new BigDecimal("100"))
                            .divide(total, PRECISAO_INTERMEDIARIA, RoundingMode.HALF_EVEN)
                            .setScale(2, RoundingMode.HALF_EVEN);

            resultado.add(CurvaAbcItemResponse.builder()
                    .produtoId(produto.produtoId())
                    .produtoNome(produto.produtoNome())
                    .sku(produto.sku())
                    .faturamento(parte)
                    .participacaoPercentual(participacao)
                    .percentualAcumulado(acumuladoExibicao)
                    .classe(semFaturamento ? "C" : classe(resultado.isEmpty(), acumuladoExato, limiteA, limiteB))
                    .build());
        }
        return resultado;
    }

    private static String classe(boolean primeiro, BigDecimal acumuladoExato, BigDecimal limiteA, BigDecimal limiteB) {
        if (primeiro || acumuladoExato.compareTo(limiteA) <= 0) {
            return "A";
        }
        if (acumuladoExato.compareTo(limiteB) <= 0) {
            return "B";
        }
        return "C";
    }
}