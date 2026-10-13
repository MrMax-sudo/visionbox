package com.visionbox.modules.financeiro.maquininha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaquininhaCartaoResponse {
    private UUID id;
    private String nome;
    private String adquirente;
    private boolean ativo;
    private BigDecimal debitoTaxaPercentual;
    private BigDecimal debitoTaxaFixa;
    private BigDecimal credito1xTaxaPercentual;
    private BigDecimal credito1xTaxaFixa;
    private BigDecimal credito2a6TaxaPercentual;
    private BigDecimal credito2a6TaxaFixa;
    private BigDecimal credito7a12TaxaPercentual;
    private BigDecimal credito7a12TaxaFixa;
}
