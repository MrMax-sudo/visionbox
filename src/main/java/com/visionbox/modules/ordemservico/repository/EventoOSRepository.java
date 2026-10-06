package com.visionbox.modules.ordemservico.repository;

import com.visionbox.modules.ordemservico.domain.EventoOS;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventoOSRepository extends JpaRepository<EventoOS, UUID> {
    List<EventoOS> findByOrdemServicoIdAndLojaIdOrderByDataHoraAsc(UUID ordemServicoId, UUID lojaId);
    List<EventoOS> findByLojaIdOrderByDataHoraDesc(UUID lojaId);
}
