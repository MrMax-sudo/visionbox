package com.visionbox.modules.seguranca.desconto.service;

/**
 * Atingiu o limite de tentativas de PIN de alçada de desconto (P7).
 * <p>
 * Lançada pelo controller (fora da transação do service) quando o rate-limit
 * estourou; {@code ProblemDetailHandler} converte em HTTP 429 (RFC 7807).
 * NUNCA carrega o PIN — a mensagem exibida é genérica de propósito.
 */
public class RateLimitExcedidoException extends RuntimeException {

    public RateLimitExcedidoException() {
        super("Limite de tentativas de autorização de desconto excedido");
    }
}