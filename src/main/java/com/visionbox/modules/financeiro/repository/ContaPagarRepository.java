package com.visionbox.modules.financeiro.repository;

import com.visionbox.modules.financeiro.domain.ContaPagar;
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

public interface ContaPagarRepository extends JpaRepository<ContaPagar, UUID> {

    Optional<ContaPagar> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<ContaPagar> findAllByLojaId(UUID lojaId, Pageable pageable);

    Page<ContaPagar> findByLojaIdAndStatus(UUID lojaId, ContaPagar.StatusContaPagar status, Pageable pageable);

    Page<ContaPagar> findByLojaIdAndFornecedorContainingIgnoreCase(UUID lojaId, String fornecedor, Pageable pageable);

    List<ContaPagar> findByLojaIdAndVencimentoBetween(UUID lojaId, LocalDate inicio, LocalDate fim);

    List<ContaPagar> findByLojaIdAndStatusAndVencimentoBefore(UUID lojaId, ContaPagar.StatusContaPagar status, LocalDate data);

    /** US13 — conciliação OFX: candidatas pelo mesmo valor (status != CANCELADO). */
    List<ContaPagar> findByLojaIdAndValorAndStatusNot(UUID lojaId, BigDecimal valor, ContaPagar.StatusContaPagar status);

    /** US13 — DRE por OS: custo da OS, opcionalmente no período. */
    List<ContaPagar> findByLojaIdAndOrdemServicoId(UUID lojaId, UUID ordemServicoId);

    List<ContaPagar> findByLojaIdAndOrdemServicoIdAndVencimentoBetween(
            UUID lojaId, UUID ordemServicoId, LocalDate inicio, LocalDate fim);

    @Query("select coalesce(sum(c.valor), 0) from ContaPagar c where c.lojaId = :lojaId and c.status <> 'CANCELADO' and c.vencimento between :inicio and :fim")
    BigDecimal sumValorByLojaIdAndVencimentoBetween(@Param("lojaId") UUID lojaId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query("select coalesce(sum(c.valor), 0) from ContaPagar c where c.lojaId = :lojaId and c.status = 'PAGO' and c.vencimento between :inicio and :fim")
    BigDecimal sumValorPagoByLojaIdAndVencimentoBetween(@Param("lojaId") UUID lojaId, @Param("inicio") LocalDate inicio, @Param("fim") LocalDate fim);

    @Query("select coalesce(sum(c.valor), 0) from ContaPagar c where c.lojaId = :lojaId and c.status in ('PAGO','PENDENTE','PARCIAL','VENCIDO')")
    BigDecimal sumCustoTotal(@Param("lojaId") UUID lojaId);

    /**
     * §3.3 métricas do hub (V41) — soma o SALDO EM ABERTO (valor - valor_pago; conta_pagar
     * não tem coluna generated) das contas a pagar com vencimento no período. Exclui
     * CANCELADO; PAGO entra com aberto=0. R1: escopo loja_id. SUM no banco.
     */
    @Query("select coalesce(sum(coalesce(c.valor, 0) - coalesce(c.valorPago, 0)), 0) from ContaPagar c "
            + "where c.lojaId = :lojaId and c.status <> 'CANCELADO' and c.vencimento between :inicio and :fim")
    BigDecimal sumSaldoAbertoByLojaIdAndVencimentoBetween(@Param("lojaId") UUID lojaId,
                                                           @Param("inicio") LocalDate inicio,
                                                           @Param("fim") LocalDate fim);

    /**
     * §3.3 métricas (V41) — soma o saldo em aberto das contas a pagar vencidas até
     * {@code hoje} (vencimento estritamente anterior). Exclui CANCELADO. R1: escopo loja_id.
     */
    @Query("select coalesce(sum(coalesce(c.valor, 0) - coalesce(c.valorPago, 0)), 0) from ContaPagar c "
            + "where c.lojaId = :lojaId and c.status <> 'CANCELADO' and c.vencimento < :hoje")
    BigDecimal sumSaldoAbertoVencidosAte(@Param("lojaId") UUID lojaId, @Param("hoje") LocalDate hoje);
}
