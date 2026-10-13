package com.visionbox.modules.ordemservico.repository;

import com.visionbox.modules.ordemservico.domain.OrdemServicoPagamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OrdemServicoPagamentoRepository extends JpaRepository<OrdemServicoPagamento, UUID> {
    void deleteAllByOrdemServicoIdAndLojaId(UUID ordemServicoId, UUID lojaId);

    java.util.List<OrdemServicoPagamento> findAllByOrdemServicoIdAndLojaId(UUID ordemServicoId, UUID lojaId);

    java.util.List<OrdemServicoPagamento> findAllByLojaIdAndOrdemServicoIdIn(UUID lojaId, java.util.Collection<UUID> ordemServicoIds);
}