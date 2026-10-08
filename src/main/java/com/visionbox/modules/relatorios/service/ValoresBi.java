package com.visionbox.modules.relatorios.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Convenção monetária dos relatórios BI (US16): dinheiro SEMPRE numeric(12,2)
 * com HALF_EVEN — mesmo padrão do financeiro/DRE do VisionBox.
 */
final class ValoresBi {

    private ValoresBi() {
    }

    /** Normaliza o valor para 2 casas HALF_EVEN (null-safe). */
    static BigDecimal dinheiro(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor.setScale(2, RoundingMode.HALF_EVEN);
    }

    /** percentual = numerador / denominador × 100, 2 casas HALF_EVEN (0 quando denominador = 0). */
    static BigDecimal percentual(BigDecimal numerador, BigDecimal denominador) {
        if (denominador == null || denominador.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN);
        }
        return numerador == null
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN)
                : numerador.multiply(new BigDecimal("100"))
                        .divide(denominador, 2, RoundingMode.HALF_EVEN);
    }
}