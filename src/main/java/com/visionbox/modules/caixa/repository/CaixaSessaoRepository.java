package com.visionbox.modules.caixa.repository;

import com.visionbox.modules.caixa.domain.CaixaSessao;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CaixaSessaoRepository extends JpaRepository<CaixaSessao, UUID> {

    Optional<CaixaSessao> findByIdAndLojaId(UUID id, UUID lojaId);

    @Query("SELECT s FROM CaixaSessao s WHERE s.lojaId = :lojaId AND s.status = 'ABERTO' ORDER BY s.abertoEm DESC LIMIT 1")
    Optional<CaixaSessao> findSessaoAbertaAtual(@Param("lojaId") UUID lojaId);

    Page<CaixaSessao> findByLojaIdOrderByAbertoEmDesc(UUID lojaId, Pageable pageable);
}
