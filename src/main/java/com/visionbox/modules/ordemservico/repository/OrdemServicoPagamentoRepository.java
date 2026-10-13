package com.visionbox.modules.ordemservico.repository;

import com.visionbox.modules.ordemservico.domain.OrdemServicoPagamento;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface OrdemServicoPagamentoRepository extends JpaRepository<OrdemServicoPagamento, UUID> {
    void deleteAllByOrdemServicoIdAndLojaId(UUID ordemServicoId, UUID lojaId);

    java.util.List<OrdemServicoPagamento> findAllByOrdemServicoIdAndLojaId(UUID ordemServicoId, UUID lojaId);

    java.util.List<OrdemServicoPagamento> findAllByLojaIdAndOrdemServicoIdIn(UUID lojaId, java.util.Collection<UUID> ordemServicoIds);

    /**
     * Apuração por forma de pagamento para o relatório de fechamento de caixa (Fase 2).
     * Soma pagamentos de vendas no período, excluindo OS canceladas.
     * Retorna linhas [forma_pagamento_id, forma_pagamento_nome, total].
     */
    @Query("SELECT p.formaPagamentoId, p.formaPagamentoNome, SUM(p.valor) " +
           "FROM OrdemServicoPagamento p " +
           "WHERE p.lojaId = :lojaId " +
           "AND p.criadoEm >= :inicio AND p.criadoEm < :fim " +
           "AND NOT EXISTS (SELECT 1 FROM OrdemServico o WHERE o.id = p.ordemServicoId AND o.status = :cancelado) " +
           "GROUP BY p.formaPagamentoId, p.formaPagamentoNome")
    List<Object[]> somarPorFormaPagamentoNoPeriodo(
            @Param("lojaId") UUID lojaId,
            @Param("inicio") OffsetDateTime inicio,
            @Param("fim") OffsetDateTime fim,
            @Param("cancelado") StatusOS cancelado);
}