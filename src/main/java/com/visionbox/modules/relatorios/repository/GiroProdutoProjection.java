package com.visionbox.modules.relatorios.repository;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Projeção nativa do ranking de giro: agregação por produto (quantidade vendida e
 * faturamento no período) — uma OS conta 1 para cada produto vinculado
 * (armacao_id/lente_id). Alias em camelCase casa com os getters (Spring Data).
 */
public interface GiroProdutoProjection {

    UUID getProdutoId();

    String getProdutoNome();

    String getSku();

    String getTipoProduto();

    Long getQuantidadeVendida();

    BigDecimal getFaturamento();
}