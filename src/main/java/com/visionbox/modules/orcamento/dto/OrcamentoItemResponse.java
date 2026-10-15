package com.visionbox.modules.orcamento.dto;

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
public class OrcamentoItemResponse {
    private UUID id;
    private UUID produtoId;
    private String sku;
    private String descricao;
    private BigDecimal quantidade;
    private BigDecimal precoUnitario;
    private BigDecimal desconto;
    private BigDecimal subtotal;
}
