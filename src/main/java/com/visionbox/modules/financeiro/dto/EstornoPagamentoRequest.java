package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request do estorno de baixa de Conta a Receber (reabertura de título §3.3).
 * Body opcional — a observação é livre e vai para o movimento de caixa ESTORNO
 * e para o log de auditoria (quem estornou vem do JWT).
 * Idempotência (R4): header {@code Idempotency-Key} (UUID v4) — coberto
 * globalmente pelo {@code IdempotencyFilter}.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EstornoPagamentoRequest {

    /** Motivo do estorno (ex.: "cliente pagou com cheque sem fundo"). */
    private String observacao;
}
