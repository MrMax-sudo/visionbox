package com.visionbox.modules.financeiro.comissao.repository;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ComissaoConfigRepository extends JpaRepository<ComissaoConfig, UUID> {

    Optional<ComissaoConfig> findByIdAndLojaId(UUID id, UUID lojaId);

    List<ComissaoConfig> findByLojaIdAndAtivoTrue(UUID lojaId);
}
