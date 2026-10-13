package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Response de uma linha do histórico de baixas (conta_receber_pagamento). */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContaReceberPagamentoResponse {

    private UUID id;
    private UUID contaReceberId;
    private UUID caixaId;
    private UUID usuarioId;
    private UUID formaPagamentoId;
    private BigDecimal valorPago;
    /** V41 — desconto da baixa (abateu o título junto com valorPago). Default 0. */
    private BigDecimal valorDesconto;
    /** V41 — juros/multa da baixa (receita extra, não abateu o título). Default 0. */
    private BigDecimal valorJuros;
    private OffsetDateTime dataPagamento;
    private String observacao;
    private OffsetDateTime criadoEm;
}
