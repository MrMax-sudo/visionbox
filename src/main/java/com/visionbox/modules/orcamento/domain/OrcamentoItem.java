package com.visionbox.modules.orcamento.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "orcamento_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrcamentoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "loja_id", nullable = false)
    private UUID lojaId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "orcamento_id", nullable = false)
    private Orcamento orcamento;

    @Column(name = "produto_id")
    private UUID produtoId;

    @Column(length = 60)
    private String sku;

    @Column(nullable = false, length = 255)
    private String descricao;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal quantidade = BigDecimal.ONE;

    @Column(name = "preco_unitario", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal precoUnitario = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal desconto = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "criado_em", nullable = false)
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
