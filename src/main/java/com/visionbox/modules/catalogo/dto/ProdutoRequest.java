package com.visionbox.modules.catalogo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProdutoRequest {
    @NotBlank
    private String sku;
    private String codigoBarras;
    @NotBlank
    private String nome;
    private String descricao;
    private String tipoProduto; // ARMACAO, LENTE etc
    private UUID marcaId;
    private UUID categoriaId;
    private String marca;
    private String categoria;
    private String ncm;
    private String cest;
    private String cfop;
    private String cbenef;
    @NotNull
    private BigDecimal custo;
    @NotNull
    private BigDecimal precoVenda;
    private Integer estoqueQuantidade;
    private Boolean ativoVenda;
}
