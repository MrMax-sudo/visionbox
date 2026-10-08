package com.visionbox.modules.relatorios.repository;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Projeção nativa por OS para margem: uma linha por OS com o vendedor (primeiro
 * responsável humano da OS), receita (soma dos títulos não cancelados) e custo
 * (custo unitário de armação + lente). A agregação por vendedor é feita em
 * {@code MargemVendedorAggregator} (regra de cálculo testável em memória).
 */
public interface MargemOsProjection {

    UUID getOsId();

    String getVendedor();

    BigDecimal getReceita();

    BigDecimal getCusto();
}