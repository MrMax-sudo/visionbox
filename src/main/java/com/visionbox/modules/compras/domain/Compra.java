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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Compra — cabeçalho da NF-e de ENTRADA importada por XML (§3.4).
 * <p>
 * Multi-tenant por loja_id (ADR-001), ativo soft-delete, RLS fail-closed.
 * {@code chaveAcesso} tem índice único parcial por loja → idempotência da importação (R4).
 * Emissão fiscal fica com o Flowbox (R3): aqui o XML só é consumido.
 */
@Entity
@Table(name = "compra")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Compra extends EntidadeBase {

    public enum StatusCompra { IMPORTADA, CONFIRMADA, CANCELADA }

    @Column(name = "numero", nullable = false, length = 50)
    private String numero;

    @Column(name = "serie", length = 10)
    private String serie;

    /** Chave de acesso da NF-e (44 dígitos) — dedup da importação por loja. */
    @Column(name = "chave_acesso", length = 44)
    private String chaveAcesso;

    @Column(name = "data_emissao", nullable = false)
    private LocalDate dataEmissao;

    @Column(name = "fornecedor_nome", nullable = false, length = 200)
    private String fornecedorNome;

    /** CNPJ jurídico do emitente (dado fiscal da NF-e; não é CPF pessoal). */
    @Column(name = "fornecedor_cnpj", length = 14)
    private String fornecedorCnpj;

    @Column(name = "valor_subtotal", precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal valorSubtotal = BigDecimal.ZERO;

    @Column(name = "desconto", precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal desconto = BigDecimal.ZERO;

    @Column(name = "frete", precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal frete = BigDecimal.ZERO;

    @Column(name = "valor_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotal;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @lombok.Builder.Default
    private StatusCompra status = StatusCompra.IMPORTADA;

    /** XML integral da nota (entrada fiscal — retenção por obrigação legal, LGPD art. 16 II). */
    @Column(name = "xml_fiscal", columnDefinition = "TEXT")
    private String xmlFiscal;

    /** Usuário que importou (deriva do JWT; sem FK — padrão conta_receber_pagamento.usuario_id). */
    @Column(name = "usuario_id")
    private UUID usuarioId;

    @OneToMany(mappedBy = "compra", cascade = CascadeType.ALL, orphanRemoval = true)
    @lombok.Builder.Default
    private List<CompraItem> itens = new ArrayList<>();

    public void addItem(CompraItem item) {
        itens.add(item);
        item.setCompra(this);
    }
}
