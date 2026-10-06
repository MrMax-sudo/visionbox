package com.visionbox.modules.catalogo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProdutoResponse {
    private UUID id;
    private UUID lojaId;
    private String sku;
    private String codigoBarras;
    private String nome;
    private String descricao;
    private String tipoProduto;
    private UUID marcaId;
    private UUID categoriaId;
    private String marca;
    private String categoria;
    private String ncm;
    private String cest;
    private String cfop;
    private String cbenef;
    private BigDecimal custo;
    private BigDecimal precoVenda;
    private Integer estoqueQuantidade;
    private Integer estoqueReservado;
    private boolean ativoVenda;
    private boolean ativo;
    private OffsetDateTime criadoEm;
}
