package com.visionbox.modules.financeiro.formapagamento.repository;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

    public interface FormaPagamentoRepository extends JpaRepository<FormaPagamento, UUID> {
    Optional<FormaPagamento> findByIdAndLojaId(UUID id, UUID lojaId);
    List<FormaPagamento> findByLojaId(UUID lojaId);
    List<FormaPagamento> findByLojaIdAndAtivoTrue(UUID lojaId);
    Optional<FormaPagamento> findByLojaIdAndPadraoTrue(UUID lojaId);

    /** Resolução em lote de nomes para resposta de OS (R1): snapshot ausente no pagamento. */
    List<FormaPagamento> findByLojaIdAndIdIn(UUID lojaId, java.util.Collection<UUID> ids);
}
