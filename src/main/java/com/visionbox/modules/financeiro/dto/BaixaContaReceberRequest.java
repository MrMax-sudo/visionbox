package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Request de baixa de Conta a Receber — aceita valor parcial (§3.3 Plano Robustez).
 * Idempotência (R4): enviar header {@code Idempotency-Key} (UUID v4) — coberto
 * globalmente pelo {@code IdempotencyFilter}.
 * <p>
 * Desconto/juros (V41, decisão D-021 — semântica exata):
 * <ul>
 *   <li>{@code desconto} — valor abatido do título SEM dinheiro entrar: o que efetivamente
 *       quita é {@code valorPago + desconto} (validado contra o saldo em aberto). Soma ao
 *       {@code valor_pago} agregado da conta (fonte da coluna GENERATED {@code valor_aberto}).</li>
 *   <li>{@code juros} — receita extra paga pelo cliente (mora/multa): <b>NÃO</b> altera o
 *       saldo em aberto; entra no caixa somada ao {@code valorPago}.</li>
 * </ul>
 * Ambos opcionais, {@code >= 0}, default zero. Desconto só é aceito com {@code valorPago}
 * explícito (default de valorPago é o saldo integral, o que faria a soma exceder o aberto).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class BaixaContaReceberRequest {

    /** Valor desta baixa (parcial ou total). Se null, baixa o saldo em aberto integralmente. */
    @com.fasterxml.jackson.annotation.JsonAlias("valor")
    private BigDecimal valorPago;

    /** Forma de pagamento recebida (Dinheiro, PIX, Cartão...). Opcional, mas recomendado. */
    private UUID formaPagamentoId;

    /** Desconto concedido nesta baixa (opcional, >= 0, default 0). Quita parte do título junto com valorPago. */
    @jakarta.validation.constraints.DecimalMin(value = "0.0", message = "desconto deve ser >= 0")
    private BigDecimal desconto;

    /** Juros/multa pagos pelo cliente (opcional, >= 0, default 0). Receita extra — não altera o saldo em aberto. */
    @jakarta.validation.constraints.DecimalMin(value = "0.0", message = "juros deve ser >= 0")
    private BigDecimal juros;

    /** Observação livre da baixa (ex: "pagou 1º parcela em dinheiro"). */
    private String observacao;
}
