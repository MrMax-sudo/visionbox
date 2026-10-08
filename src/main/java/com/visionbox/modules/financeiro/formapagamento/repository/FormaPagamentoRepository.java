package com.visionbox.modules.financeiro.formapagamento.repository;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

    public interface FormaPagamentoRepository extends JpaRepository<FormaPagamento, UUID> {
    Optional<FormaPagamento> findByIdAndLojaId(UUID id, UUID lojaId);
    List<FormaPagamento> findByLojaIdAndAtivoTrue(UUID lojaId);
    Optional<FormaPagamento> findByLojaIdAndPadraoTrue(UUID lojaId);
}
