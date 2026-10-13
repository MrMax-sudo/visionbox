package com.visionbox.modules.caixa.repository;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CaixaMovimentoRepository extends JpaRepository<CaixaMovimento, UUID> {

    List<CaixaMovimento> findBySessaoIdAndLojaIdOrderByCriadoEmAsc(UUID sessaoId, UUID lojaId);

    /** Extrato paginado do turno (R1: sempre com lojaId). */
    Page<CaixaMovimento> findBySessaoIdAndLojaId(UUID sessaoId, UUID lojaId, Pageable pageable);

    /** Extrato paginado do turno filtrado por tipo de movimento (SANGRIA, SUPRIMENTO, ...). */
    Page<CaixaMovimento> findBySessaoIdAndLojaIdAndTipo(
            UUID sessaoId, UUID lojaId, CaixaMovimento.TipoMovimento tipo, Pageable pageable);
}
