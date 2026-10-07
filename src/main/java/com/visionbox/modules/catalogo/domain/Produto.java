package com.visionbox.modules.catalogo.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;

/**
 * Produto do catálogo.
 * <p>
 * A unicidade de {@code (loja_id, sku)} agora é garantida por índice PARCIAL
 * {@code WHERE ativo = true} (V21__unicidade_parcial_produto_sku.sql), e não mais pela
 * unique completa do {@code @Table}: com o soft-delete ({@code @SQLRestriction}), a unique
 * completa impedia recriar o mesmo SKU após excluir (o {@code existsBySkuAndLojaId} não via a
 * linha inativa e o INSERT estourava a constraint → 400 "Registro duplicado").
 * Linhas inativas não disputam SKU; as ativas continuam únicas.
 */
@Entity
@Table(name = "produto")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Produto extends EntidadeBase {

    @Column(nullable = false, length = 50)
    private String sku;

    @Column(name = "codigo_barras", length = 50)
    private String codigoBarras;

    @Column(nullable = false, length = 200)
    private String nome;

    @Column(length = 1000)
    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_produto", nullable = false, length = 30)
    @lombok.Builder.Default
    private TipoProduto tipoProduto = TipoProduto.ARMACAO;

    @Column(name = "marca_id")
    private java.util.UUID marcaId;

    @Column(name = "categoria_id")
    private java.util.UUID categoriaId;

    @Column(length = 100)
    private String marca; // denormalizado para busca rápida quando Marca não usada

    @Column(length = 100)
    private String categoria;

    @Column(name = "ncm", length = 8)
    private String ncm;

    @Column(name = "cest", length = 7)
    private String cest;

    @Column(name = "cfop", length = 4)
    private String cfop;

    @Column(name = "cbenef", length = 10)
    private String cbenef;

    @Column(name = "custo", precision = 12, scale = 2, nullable = false)
    private BigDecimal custo;

    @Column(name = "preco_venda", precision = 12, scale = 2, nullable = false)
    private BigDecimal precoVenda;

    @Column(name = "estoque_quantidade", nullable = false)
    @lombok.Builder.Default
    private Integer estoqueQuantidade = 0;

    @Column(name = "estoque_reservado", nullable = false)
    @lombok.Builder.Default
    private Integer estoqueReservado = 0;

    @Column(name = "ativo_venda", nullable = false)
    @lombok.Builder.Default
    private boolean ativoVenda = true;

    public enum TipoProduto {
        ARMACAO, LENTE, LENTE_CONTATO, ACESSORIO, SERVICO
    }
}
