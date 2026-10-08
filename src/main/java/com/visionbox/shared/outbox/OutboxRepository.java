package com.visionbox.shared.outbox;

import com.visionbox.shared.idempotency.OutboxMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface OutboxRepository extends JpaRepository<OutboxMessage, UUID> {

    List<OutboxMessage> findByLojaIdAndStatusAndProximaTentativaIsNull(UUID lojaId, OutboxMessage.Status status);

    List<OutboxMessage> findByStatusAndProximaTentativaBefore(OutboxMessage.Status status, OffsetDateTime antes);

    List<OutboxMessage> findByIdAndLojaId(UUID id, UUID lojaId);

    // Métricas: pendentes (PENDING/FAILED) esperando publicação — visão global do scheduler
    long countByStatusIn(Collection<OutboxMessage.Status> statuses);
}
