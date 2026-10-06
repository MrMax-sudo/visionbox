package com.visionbox.modules.caixa.repository;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CaixaMovimentoRepository extends JpaRepository<CaixaMovimento, UUID> {

    List<CaixaMovimento> findBySessaoIdAndLojaIdOrderByCriadoEmAsc(UUID sessaoId, UUID lojaId);
}
