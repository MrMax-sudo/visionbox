package com.visionbox.modules.seguranca.desconto.dto;

import com.visionbox.modules.seguranca.desconto.domain.AlcadaDesconto;
import com.visionbox.modules.usuario.domain.Usuario;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Resultado da validação de alçada de desconto (P7).
 * <p>
 * {@code autorizado=false} com {@code rateLimitExcedido=false} → PIN inválido
 * (resposta genérica, sem revelar o motivo). {@code rateLimitExcedido=true} é
 * sinalizado ao controller, que mapeia para 429 (RFC 7807) — nunca 200.
 * <p>
 * Quando autorizado via PIN, {@code autorizadoPor*} identifica o usuário
 * GERENTE/ADMIN que casou o hash (rastreabilidade exigida em D-007).
 * Para desconto ≤ 15% ({@code exigePin=false}) os campos {@code autorizadoPor*}
 * ficam nulos.
 */
public record AutorizacaoDescontoResponse(
        boolean autorizado,
        boolean exigePin,
        boolean rateLimitExcedido,
        BigDecimal descontoPercentual,
        BigDecimal limiteSemPinPercentual,
        String mensagem,
        UUID autorizadoPorId,
        String autorizadoPorNome,
        String autorizadoPorPerfil
) {

    public static AutorizacaoDescontoResponse semAlcada(BigDecimal descontoPercentual) {
        return new AutorizacaoDescontoResponse(true, false, false,
                descontoPercentual, AlcadaDesconto.limiteSemPin(), null, null, null, null);
    }

    public static AutorizacaoDescontoResponse autorizado(BigDecimal descontoPercentual, Usuario autorizador) {
        return new AutorizacaoDescontoResponse(true, true, false,
                descontoPercentual, AlcadaDesconto.limiteSemPin(), null,
                autorizador.getId(), autorizador.getNome(), autorizador.getPerfil().name());
    }

    public static AutorizacaoDescontoResponse negado(BigDecimal descontoPercentual, String mensagem) {
        return new AutorizacaoDescontoResponse(false, true, false,
                descontoPercentual, AlcadaDesconto.limiteSemPin(), mensagem, null, null, null);
    }

    public static AutorizacaoDescontoResponse bloqueadoPorRateLimit(BigDecimal descontoPercentual) {
        return new AutorizacaoDescontoResponse(false, true, true,
                descontoPercentual, AlcadaDesconto.limiteSemPin(), null, null, null, null);
    }
}