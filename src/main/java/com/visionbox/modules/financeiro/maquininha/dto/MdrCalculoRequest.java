package com.visionbox.modules.financeiro.maquininha.dto;

import com.visionbox.modules.financeiro.maquininha.domain.TipoCartao;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Payload do cálculo pontual de líquido (simulação/conciliação). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MdrCalculoRequest {

    @NotNull(message = "valor é obrigatório")
    @DecimalMin(value = "0.01", message = "valor deve ser > 0")
    private BigDecimal valor;

    @NotNull(message = "tipo é obrigatório (DEBITO|CREDITO)")
    private TipoCartao tipo;

    @NotNull(message = "parcelas é obrigatório")
    private Integer parcelas;
}
