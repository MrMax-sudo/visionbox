package com.visionbox.modules.relatorios.repository;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Projeção nativa de entrada da curva ABC: faturamento por produto no período.
 * A classificação A/B/C é calculada em {@code CurvaAbcClassifier} (regra pura,
 * testável sem SQL).
 */
public interface AbcProdutoProjection {

    UUID getProdutoId();

    String getProdutoNome();

    String getSku();

    BigDecimal getFaturamento();
}