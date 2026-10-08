package com.visionbox.modules.relatorios.service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Entrada pura da curva ABC: produto + faturamento no período
 * (vem da projeção nativa {@code AbcProdutoProjection}).
 */
record AbcProduto(UUID produtoId, String produtoNome, String sku, BigDecimal faturamento) {
}