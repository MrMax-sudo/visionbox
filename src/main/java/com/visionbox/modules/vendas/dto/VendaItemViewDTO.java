package com.visionbox.modules.vendas.dto;

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
public class VendaItemViewDTO {
    private UUID produtoId;
    private String sku;
    private String nome;
    private Integer quantidade;
    private BigDecimal precoUnitario;
    private BigDecimal subtotal;
    private BigDecimal desconto;
    private String tipoProduto;
}
