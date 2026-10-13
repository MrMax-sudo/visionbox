package com.visionbox.modules.financeiro.maquininha.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaquininhaCartaoRequest {

    @NotBlank(message = "nome é obrigatório")
    private String nome;

    @NotBlank(message = "adquirente é obrigatória")
    private String adquirente;

    private Boolean ativo;

    @NotNull @DecimalMin(value = "0", message = "debitoTaxaPercentual >= 0")
    private BigDecimal debitoTaxaPercentual;

    @NotNull @DecimalMin(value = "0", message = "debitoTaxaFixa >= 0")
    private BigDecimal debitoTaxaFixa;

    @NotNull @DecimalMin(value = "0", message = "credito1xTaxaPercentual >= 0")
    private BigDecimal credito1xTaxaPercentual;

    @NotNull @DecimalMin(value = "0", message = "credito1xTaxaFixa >= 0")
    private BigDecimal credito1xTaxaFixa;

    @NotNull @DecimalMin(value = "0", message = "credito2a6TaxaPercentual >= 0")
    private BigDecimal credito2a6TaxaPercentual;

    @NotNull @DecimalMin(value = "0", message = "credito2a6TaxaFixa >= 0")
    private BigDecimal credito2a6TaxaFixa;

    @NotNull @DecimalMin(value = "0", message = "credito7a12TaxaPercentual >= 0")
    private BigDecimal credito7a12TaxaPercentual;

    @NotNull @DecimalMin(value = "0", message = "credito7a12TaxaFixa >= 0")
    private BigDecimal credito7a12TaxaFixa;
}
