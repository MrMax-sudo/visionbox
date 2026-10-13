package com.visionbox.modules.financeiro.maquininha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Resultado do cálculo de líquido MDR (§3.5):
 * {@code taxaValor = valorBruto * (taxaPercentual/100) + taxaFixa}; {@code valorLiquido = valorBruto - taxaValor}.
 * BigDecimal, HALF_EVEN 2 casas (mesmo critério do financeiro).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResultadoMdr {
    private UUID maquininhaId;
    private String tipo;
    private Integer parcelas;
    private String faixa;
    private BigDecimal valorBruto;
    private BigDecimal taxaPercentual;
    private BigDecimal taxaFixa;
    private BigDecimal taxaValor;
    private BigDecimal valorLiquido;
}
