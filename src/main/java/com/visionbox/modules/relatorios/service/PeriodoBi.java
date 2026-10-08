package com.visionbox.modules.relatorios.service;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Período já resolvido do relatório: loja da requisição (TenantContext) e o
 * intervalo [inicio, fimExclusivo) em timestamptz (fuso America/Sao_Paulo).
 */
record PeriodoBi(UUID lojaId, OffsetDateTime inicio, OffsetDateTime fimExclusivo) {
}