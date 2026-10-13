package com.visionbox.modules.financeiro.maquininha.repository;

import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MaquininhaCartaoRepository extends JpaRepository<MaquininhaCartao, UUID> {

    Optional<MaquininhaCartao> findByIdAndLojaId(UUID id, UUID lojaId);

    List<MaquininhaCartao> findByLojaIdAndAtivoTrue(UUID lojaId);
}
