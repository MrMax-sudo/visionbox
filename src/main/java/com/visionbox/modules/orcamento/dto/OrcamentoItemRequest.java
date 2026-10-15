package com.visionbox.modules.orcamento.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class OrcamentoItemRequest {
    private UUID produtoId;
    private String sku;
    @NotBlank
    private String descricao;
    @NotNull
    private BigDecimal quantidade;
    @NotNull
    private BigDecimal precoUnitario;
    private BigDecimal desconto;
    private BigDecimal subtotal;
}
