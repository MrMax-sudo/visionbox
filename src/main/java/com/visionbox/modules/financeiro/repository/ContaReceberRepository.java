package com.visionbox.modules.financeiro.repository;

import com.visionbox.modules.financeiro.domain.ContaReceber;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContaReceberRepository extends JpaRepository<ContaReceber, UUID> {

    Optional<ContaReceber> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<ContaReceber> findAllByLojaId(UUID lojaId, Pageable pageable);

    Page<ContaReceber> findByLojaIdAndStatus(UUID lojaId, ContaReceber.StatusConta status, Pageable pageable);

    Page<ContaReceber> findByLojaIdAndClienteId(UUID lojaId, UUID clienteId, Pageable pageable);

    List<ContaReceber> findByLojaIdAndVencimentoBetween(UUID lojaId, LocalDate inicio, LocalDate fim);

    List<ContaReceber> findByLojaIdAndStatusAndVencimentoBefore(UUID lojaId, ContaReceber.StatusConta status, LocalDate data);

    /** US13 — conciliação OFX: candidatas pelo mesmo valor (status != CANCELADO). */
    List<ContaReceber> findByLojaIdAndValorAndStatusNot(UUID lojaId, BigDecimal valor, ContaReceber.StatusConta status);

    /** US13 — DRE por OS: receita da OS, opcionalmente no período. */
    List<ContaReceber> findByLojaIdAndOrdemServicoId(UUID lojaId, UUID ordemServicoId);

    List<ContaReceber> findByLojaIdAndOrdemServicoIdAndVencimentoBetween(
            UUID lojaId, UUID ordemServicoId, LocalDate inicio, LocalDate fim);

    /**
     * §3.3 métricas do hub (V41) — soma o VALOR EM ABERTO (coluna GENERATED valor_aberto,
     * não o valor total) dos títulos a receber com vencimento no período. Exclui
     * CANCELADO; títulos PAGO entram com aberto=0. R1: escopo loja_id. SUM no banco —
     * sem carregar páginas.
     */
    @Query("select coalesce(sum(c.valorAberto), 0) from ContaReceber c "
            + "where c.lojaId = :lojaId and c.status <> 'CANCELADO' and c.vencimento between :inicio and :fim")
    BigDecimal sumValorAbertoByLojaIdAndVencimentoBetween(@Param("lojaId") UUID lojaId,
                                                          @Param("inicio") LocalDate inicio,
                                                          @Param("fim") LocalDate fim);

    /**
     * §3.3 métricas (V41) — soma o valor em aberto dos títulos a receber VENCIDOS até
     * {@code hoje} (vencimento estritamente anterior a hoje — mesmo critério de
     * {@code ContaReceber.isVencida()}). Exclui CANCELADO. R1: escopo loja_id.
     */
    @Query("select coalesce(sum(c.valorAberto), 0) from ContaReceber c "
            + "where c.lojaId = :lojaId and c.status <> 'CANCELADO' and c.vencimento < :hoje")
    BigDecimal sumValorAbertoVencidosAte(@Param("lojaId") UUID lojaId, @Param("hoje") LocalDate hoje);
}
