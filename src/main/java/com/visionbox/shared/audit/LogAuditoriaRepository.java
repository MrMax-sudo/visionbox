package com.visionbox.shared.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LogAuditoriaRepository extends JpaRepository<LogAuditoria, UUID> {

    List<LogAuditoria> findByLojaIdAndEntidadeAndEntidadeId(UUID lojaId, String entidade, String entidadeId);

    List<LogAuditoria> findByLojaIdOrderByCriadoEmDesc(UUID lojaId);
}
