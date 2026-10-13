package com.visionbox.modules.financeiro.maquininha.domain;

/**
 * Faixa de cobrança da maquininha (§3.5): débito à vista e crédito 1x / 2-6x / 7-12x.
 */
public enum FaixaMdr {
    DEBITO, CREDITO_1X, CREDITO_2_6, CREDITO_7_12
}
