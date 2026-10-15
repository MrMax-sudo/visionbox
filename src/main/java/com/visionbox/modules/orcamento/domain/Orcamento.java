package com.visionbox.modules.orcamento.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orcamento", uniqueConstraints = @UniqueConstraint(columnNames = {"loja_id", "numero"}))
@SQLRestriction("ativo = true")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Orcamento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "loja_id", nullable = false)
    private UUID lojaId;

    @Column(nullable = false, length = 30)
    private String numero;

    @Column(name = "cliente_id")
    private UUID clienteId;

    @Column(name = "cliente_nome", nullable = false)
    private String clienteNome;

    @Column(name = "cliente_cpf", length = 20)
    private String clienteCpf;

    @Column(name = "cliente_telefone", length = 30)
    private String clienteTelefone;

    @Column(name = "vendedor_id")
    private UUID vendedorId;

    @Column(name = "vendedor_nome", length = 150)
    private String vendedorNome;

    @Column(name = "valor_subtotal", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal valorSubtotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal desconto = BigDecimal.ZERO;

    @Column(name = "valor_total", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal valorTotal = BigDecimal.ZERO;

    @Column(name = "validade_dias", nullable = false)
    @Builder.Default
    private Integer validadeDias = 15;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private OrcamentoStatus status = OrcamentoStatus.ABERTO;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "condicoes_pagamento", length = 255)
    private String condicoesPagamento;

    @Column(name = "venda_id")
    private UUID vendaId;

    @OneToMany(mappedBy = "orcamento", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrcamentoItem> itens = new ArrayList<>();

    @Column(name = "criado_em", nullable = false)
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();

    @Column(name = "atualizado_em", nullable = false)
    @Builder.Default
    private OffsetDateTime atualizadoEm = OffsetDateTime.now();

    @Column(nullable = false)
    @Builder.Default
    private Boolean ativo = true;

    public void addItem(OrcamentoItem item) {
        if (itens == null) {
            itens = new ArrayList<>();
        }
        itens.add(item);
        item.setOrcamento(this);
    }
}
