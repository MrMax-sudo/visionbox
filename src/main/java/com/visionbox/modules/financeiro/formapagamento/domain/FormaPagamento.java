package com.visionbox.modules.financeiro.formapagamento.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;

@Entity
@Table(name = "forma_pagamento")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class FormaPagamento extends EntidadeBase {

    @Column(nullable = false)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoFormaPagamento tipo;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(nullable = false)
    private boolean padrao = false;

    @Column(precision = 5, scale = 2)
    private BigDecimal taxaPercentual;

    @Column
    private Integer prazoDias;

    @Column(nullable = false)
    private boolean permiteParcelar = false;

    @Column
    private Integer maxParcelas;

    @Column(length = 2)
    private String tPagNfce;

    public enum TipoFormaPagamento {
        DINHEIRO, PIX, DEBITO, CREDITO, CREDIARIO
    }
}
