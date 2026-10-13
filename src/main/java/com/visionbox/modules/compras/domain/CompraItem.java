package com.visionbox.modules.compras.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Item da NF-e de entrada (§3.4): descrição, NCM, EAN, quantidade e custo extraídos do XML.
 * {@code produtoId} é o resultado do de-para com o catálogo (EAN/SKU) ou do pré-cadastro automático.
 * Sem FK para produto (mesmo padrão de estoque.produto_id — D-005).
 */
@Entity
@Table(name = "compra_item")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class CompraItem extends EntidadeBase {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compra_id", nullable = false)
    private Compra compra;

    @Column(name = "produto_id", nullable = false)
    private UUID produtoId;

    @Column(name = "descricao", nullable = false, length = 200)
    private String descricao;

    @Column(name = "ncm", length = 8)
    private String ncm;

    @Column(name = "ean", length = 50)
    private String ean;

    @Column(name = "codigo_fornecedor", length = 50)
    private String codigoFornecedor;

    @Column(name = "unidade", length = 6)
    private String unidade;

    @Column(name = "quantidade", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(name = "custo_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal custoUnitario;

    @Column(name = "valor_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotal;

    /**
     * TRUE quando o {@code produtoId} foi criado pelo pré-cadastro automático desta
     * importação (de-para EAN→SKU não casou); FALSE quando o produto já existia no
     * catálogo. Apenas transitório: preenchido só no fluxo de importação, não é
     * persistido (sem coluna em compra_item — recomputar o de-para numa leitura
     * posterior sempre "casaria", porque o pré-cadastro passa a existir no catálogo).
     * Leituras persistidas (listar/buscar) expõem null no DTO — contrato em
     * {@link com.visionbox.modules.compras.dto.CompraItemResponse}.
     */
    @Transient
    private boolean preCadastrado;
}
