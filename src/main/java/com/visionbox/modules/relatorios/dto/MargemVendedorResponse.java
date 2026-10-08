package com.visionbox.modules.relatorios.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Margem agregada por vendedor (US16).
 * <p>
 * Receita = soma dos títulos (conta_receber) das OS do vendedor no período (não cancelados);
 * Custo = soma do custo (produto.custo) de armação + lente das OS;
 * Margem = receita − custo; margemPercentual = margem / receita × 100.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MargemVendedorResponse {

    /** Primeiro responsável humano da OS; "sistema" quando não há responsável registrado. */
    private String vendedor;
    /** Quantidade de OS agregadas no vendedor. */
    private long totalOs;
    /** Receita bruta (conta_receber ativa e não cancelada) — numeric 12,2. */
    private BigDecimal receita;
    /** Custo dos produtos das OS (custo unitário × 1 por OS) — numeric 12,2. */
    private BigDecimal custo;
    /** Margem = receita − custo, HALF_EVEN 2 casas. */
    private BigDecimal margem;
    /** margem / receita × 100, HALF_EVEN 2 casas (0 quando receita = 0). */
    private BigDecimal margemPercentual;
}