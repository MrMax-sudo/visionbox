package com.visionbox.modules.orcamento.repository;

import com.visionbox.modules.orcamento.domain.Orcamento;
import com.visionbox.modules.orcamento.domain.OrcamentoStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrcamentoRepository extends JpaRepository<Orcamento, UUID> {

    Optional<Orcamento> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<Orcamento> findByNumeroAndLojaId(String numero, UUID lojaId);

    @Query("SELECT COUNT(o) FROM Orcamento o WHERE o.lojaId = :lojaId")
    long countByLojaId(@Param("lojaId") UUID lojaId);

    @Query("""
        SELECT o FROM Orcamento o
        WHERE o.lojaId = :lojaId
          AND (:status IS NULL OR o.status = :status)
          AND (
            :termo IS NULL OR :termo = '' OR
            LOWER(o.numero) LIKE LOWER(CONCAT('%', :termo, '%')) OR
            LOWER(o.clienteNome) LIKE LOWER(CONCAT('%', :termo, '%')) OR
            LOWER(o.clienteCpf) LIKE LOWER(CONCAT('%', :termo, '%')) OR
            LOWER(o.clienteTelefone) LIKE LOWER(CONCAT('%', :termo, '%'))
          )
        ORDER BY o.criadoEm DESC
    """)
    Page<Orcamento> listarComFiltros(
            @Param("lojaId") UUID lojaId,
            @Param("status") OrcamentoStatus status,
            @Param("termo") String termo,
            Pageable pageable
    );
}
