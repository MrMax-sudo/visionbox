package com.visionbox.modules.relatorios.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Linha da curva ABC (US16): item rankeado por faturamento com participação,
 * percentual acumulado e classe (A ≤ 80% ≤ B ≤ 95% < C).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurvaAbcItemResponse {

    private UUID produtoId;
    private String produtoNome;
    private String sku;
    /** Faturamento do produto no período (numeric 12,2). */
    private BigDecimal faturamento;
    /** faturamento / faturamentoTotal × 100 (HALF_EVEN 2 casas). */
    private BigDecimal participacaoPercentual;
    /** Soma corrente da participação (HALF_EVEN 2 casas; faixa decidida com precisão exata). */
    private BigDecimal percentualAcumulado;
    /** A | B | C conforme faixa 80/95 sobre percentual acumulado. */
    private String classe;
}