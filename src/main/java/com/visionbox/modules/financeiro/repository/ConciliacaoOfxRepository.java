package com.visionbox.modules.financeiro.repository;

import com.visionbox.modules.financeiro.domain.ConciliacaoOfx;
import com.visionbox.modules.financeiro.domain.ConciliacaoOfx.StatusConciliacao;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConciliacaoOfxRepository extends JpaRepository<ConciliacaoOfx, UUID> {

    /** Regra R1: nunca findById sem lojaId. */
    Optional<ConciliacaoOfx> findByIdAndLojaId(UUID id, UUID lojaId);

    /** Dedup por FITID único por loja (UNIQUE loja_id + fit_id). */
    boolean existsByLojaIdAndFitId(UUID lojaId, String fitId);

    /** IDs de contas a receber já CONCILIADAS (para não rematch na mesma importação). */
    @Query("select c.contaReceberId from ConciliacaoOfx c where c.lojaId = :lojaId and c.status = :status and c.contaReceberId is not null")
    List<UUID> findIdsContaReceberConciliadas(@Param("lojaId") UUID lojaId, @Param("status") StatusConciliacao status);

    /** IDs de contas a pagar já CONCILIADAS (para não rematch na mesma importação). */
    @Query("select c.contaPagarId from ConciliacaoOfx c where c.lojaId = :lojaId and c.status = :status and c.contaPagarId is not null")
    List<UUID> findIdsContaPagarConciliadas(@Param("lojaId") UUID lojaId, @Param("status") StatusConciliacao status);

    Page<ConciliacaoOfx> findByLojaId(UUID lojaId, Pageable pageable);

    Page<ConciliacaoOfx> findByLojaIdAndStatus(UUID lojaId, StatusConciliacao status, Pageable pageable);

    Page<ConciliacaoOfx> findByLojaIdAndDataPostamentoBetween(UUID lojaId, LocalDate inicio, LocalDate fim, Pageable pageable);

    Page<ConciliacaoOfx> findByLojaIdAndStatusAndDataPostamentoBetween(
            UUID lojaId, StatusConciliacao status, LocalDate inicio, LocalDate fim, Pageable pageable);
}