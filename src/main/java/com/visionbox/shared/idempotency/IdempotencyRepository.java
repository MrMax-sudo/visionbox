package com.visionbox.shared.idempotency;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdempotencyRepository extends JpaRepository<IdempotencyKey, UUID> {

    Optional<IdempotencyKey> findByLojaIdAndChave(UUID lojaId, String chave);

    Optional<IdempotencyKey> findByIdAndLojaId(UUID id, UUID lojaId);
}
