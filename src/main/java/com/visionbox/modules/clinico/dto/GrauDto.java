package com.visionbox.modules.clinico.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class GrauDto {

    @DecimalMin(value = "-30.00", message = "esferico mínimo -30")
    @DecimalMax(value = "30.00", message = "esferico máximo 30")
    private BigDecimal esferico;

    @DecimalMin(value = "-10.00", message = "cilindrico mínimo -10")
    @DecimalMax(value = "0.00", message = "cilindrico máximo 0")
    private BigDecimal cilindrico;

    @Min(value = 0, message = "eixo 0-180")
    @Max(value = 180, message = "eixo 0-180")
    private Integer eixo;

    @DecimalMin(value = "0.00", message = "adicao mínima 0")
    @DecimalMax(value = "6.00", message = "adicao máxima 6")
    private BigDecimal adicao;

    private BigDecimal dnp;
}
