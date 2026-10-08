package com.visionbox.modules.producao.repository;

import com.visionbox.modules.producao.domain.ProducaoOS;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProducaoOSRepository extends JpaRepository<ProducaoOS, UUID> {

    Optional<ProducaoOS> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<ProducaoOS> findByOrdemServicoIdAndLojaId(UUID ordemServicoId, UUID lojaId);
}