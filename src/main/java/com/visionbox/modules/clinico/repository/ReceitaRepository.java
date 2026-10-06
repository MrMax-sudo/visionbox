package com.visionbox.modules.clinico.repository;

import com.visionbox.modules.clinico.domain.Receita;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReceitaRepository extends JpaRepository<Receita, UUID> {

    Optional<Receita> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<Receita> findAllByLojaId(UUID lojaId, Pageable pageable);

    Page<Receita> findByLojaIdAndClienteId(UUID lojaId, UUID clienteId, Pageable pageable);

    // Recall: receitas com validade no intervalo e cliente com consentimento_recall=true (LGPD)
    @Query("SELECT r FROM Receita r WHERE r.lojaId = :lojaId AND r.ativo = true " +
            "AND r.dataValidade BETWEEN :inicio AND :fim " +
            "AND r.clienteId IN (SELECT c.id FROM Cliente c WHERE c.lojaId = :lojaId AND c.consentimentoRecall = true AND c.ativo = true)")
    Page<Receita> findReceitasVencidasComConsentimento(@Param("lojaId") UUID lojaId,
                                                       @Param("inicio") LocalDate inicio,
                                                       @Param("fim") LocalDate fim,
                                                       Pageable pageable);

    @Query("SELECT r FROM Receita r WHERE r.lojaId = :lojaId AND r.ativo = true " +
            "AND r.dataValidade BETWEEN :inicio AND :fim " +
            "AND r.clienteId IN (SELECT c.id FROM Cliente c WHERE c.lojaId = :lojaId AND c.consentimentoRecall = true AND c.ativo = true)")
    List<Receita> findReceitasVencidasComConsentimentoList(@Param("lojaId") UUID lojaId,
                                                           @Param("inicio") LocalDate inicio,
                                                           @Param("fim") LocalDate fim);
}
