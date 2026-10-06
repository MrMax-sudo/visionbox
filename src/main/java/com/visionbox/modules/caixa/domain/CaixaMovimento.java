package com.visionbox.modules.caixa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "caixa_movimento")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaixaMovimento {

    public enum TipoMovimento {
        ABERTURA,
        SUPRIMENTO,
        SANGRIA,
        VENDA_DINHEIRO,
        VENDA_OUTROS,
        ESTORNO,
        FECHAMENTO
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "loja_id", nullable = false)
    private UUID lojaId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sessao_id", nullable = false)
    private CaixaSessao sessao;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", length = 30, nullable = false)
    private TipoMovimento tipo;

    @Column(name = "valor", precision = 12, scale = 2, nullable = false)
    private BigDecimal valor;

    @Column(name = "forma_pagamento", length = 30)
    private String formaPagamento;

    @Column(name = "motivo", length = 255)
    private String motivo;

    @Column(name = "usuario_nome", length = 120)
    private String usuarioNome;

    @Column(name = "criado_em", columnDefinition = "timestamptz", nullable = false)
    @Builder.Default
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
