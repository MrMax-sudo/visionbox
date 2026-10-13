package com.visionbox.modules.financeiro.comissao.repository;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoLancamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ComissaoLancamentoRepository extends JpaRepository<ComissaoLancamento, UUID> {

    Optional<ComissaoLancamento> findByIdAndLojaId(UUID id, UUID lojaId);

    /** Idempotência da apuração (R4): mesma venda + vendedor já apurada. */
    List<ComissaoLancamento> findByLojaIdAndVendaIdAndVendedorIdAndAtivoTrue(
            UUID lojaId, UUID vendaId, UUID vendedorId);

    /** Todos os lançamentos ativos da venda (R1) — estorno no cancelamento (D-017 follow-up). */
    List<ComissaoLancamento> findByLojaIdAndVendaIdAndAtivoTrue(UUID lojaId, UUID vendaId);

    /** Fechamento por período: [dataInicio, dataFim exclusivo). */
    List<ComissaoLancamento> findByLojaIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
            UUID lojaId, OffsetDateTime inicio, OffsetDateTime fim);

    List<ComissaoLancamento> findByLojaIdAndVendedorIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
            UUID lojaId, UUID vendedorId, OffsetDateTime inicio, OffsetDateTime fim);
}
