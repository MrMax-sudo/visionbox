package com.visionbox.modules.relatorios.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Linha do ranking de giro de produtos (US16): quantidade vendida e faturamento
 * (preço de venda unitário do produto × OS no período) por produto da loja.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GiroProdutoResponse {

    private UUID produtoId;
    private String produtoNome;
    private String sku;
    /** TipoProduto do catálogo (ARMACAO/LENTE/...). */
    private String tipoProduto;
    /** Quantidade vendida no período (OS que referenciam o produto). */
    private Long quantidadeVendida;
    /** Faturamento = SOMATÓRIO do preço de venda nas OS do período (numeric 12,2). */
    private BigDecimal faturamento;
}