package com.visionbox.modules.relatorios.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Classificação ABC de produtos por faturamento (US16).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurvaAbcResponse {

    /** Faturamento total do período (soma dos itens) — numeric 12,2. */
    private BigDecimal totalFaturamento;
    /** Quantidade de produtos classificados. */
    private int totalProdutos;
    /** Itens ordenados por faturamento desc, com classe A/B/C. */
    private List<CurvaAbcItemResponse> itens;

    public static CurvaAbcResponse of(BigDecimal totalFaturamento, List<CurvaAbcItemResponse> itens) {
        return CurvaAbcResponse.builder()
                .totalFaturamento(totalFaturamento)
                .totalProdutos(itens != null ? itens.size() : 0)
                .itens(itens != null ? itens : List.of())
                .build();
    }
}