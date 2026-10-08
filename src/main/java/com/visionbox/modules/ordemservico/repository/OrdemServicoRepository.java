package com.visionbox.modules.ordemservico.repository;

import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrdemServicoRepository extends JpaRepository<OrdemServico, UUID> {

    Optional<OrdemServico> findByIdAndLojaId(UUID id, UUID lojaId);

    java.util.List<OrdemServico> findAllByLojaId(UUID lojaId);

    Page<OrdemServico> findAllByLojaId(UUID lojaId, Pageable pageable);

    Page<OrdemServico> findByLojaIdAndStatus(UUID lojaId, StatusOS status, Pageable pageable);

    Optional<OrdemServico> findByNumeroAndLojaId(String numero, UUID lojaId);

    long countByLojaIdAndStatus(UUID lojaId, StatusOS status);

    long countByStatus(StatusOS status);

    // Métricas: OS atrasadas por laboratório (previsao < agora, status não terminal)
    @Query("SELECT o.laboratorioId, COUNT(o) FROM OrdemServico o WHERE o.ativo = true AND o.previsaoEntrega < :agora AND o.status NOT IN :excluidos GROUP BY o.laboratorioId")
    List<Object[]> countAtrasadasPorLaboratorio(@Param("agora") OffsetDateTime agora, @Param("excluidos") Collection<StatusOS> excluidos);

    // SLA: atrasadas por loja (previsaoEntrega < now() e status NOT IN terminal)
    List<OrdemServico> findByLojaIdAndPrevisaoEntregaBeforeAndStatusNotIn(UUID lojaId, OffsetDateTime previsaoEntrega, Collection<StatusOS> status);

    Page<OrdemServico> findByLojaIdAndPrevisaoEntregaBeforeAndStatusNotIn(UUID lojaId, OffsetDateTime previsaoEntrega, Collection<StatusOS> status, Pageable pageable);

    // Job global: busca todas as OS atrasadas ainda não alertadas (independe de lojaId, para scheduler)
    @Query("SELECT o FROM OrdemServico o WHERE o.previsaoEntrega < :agora AND o.status NOT IN :excluidos AND o.alertaAtrasoDisparado = false AND o.ativo = true AND o.previsaoEntrega IS NOT NULL")
    List<OrdemServico> findAtrasadasParaAlerta(@Param("agora") OffsetDateTime agora, @Param("excluidos") Collection<StatusOS> excluidos);

    @Query("SELECT DISTINCT o.lojaId FROM OrdemServico o WHERE o.previsaoEntrega < :agora AND o.status NOT IN :excluidos AND o.alertaAtrasoDisparado = false AND o.ativo = true AND o.previsaoEntrega IS NOT NULL")
    List<UUID> findDistinctLojaIdsComAtraso(@Param("agora") OffsetDateTime agora, @Param("excluidos") Collection<StatusOS> excluidos);

    Page<OrdemServico> findByLojaIdAndStatusIn(UUID lojaId, java.util.Collection<StatusOS> status, Pageable pageable);

    Page<OrdemServico> findByLojaIdAndStatusInAndLaboratorioId(UUID lojaId, java.util.Collection<StatusOS> status, UUID laboratorioId, Pageable pageable);
}