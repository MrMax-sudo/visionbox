package com.visionbox.modules.financeiro.repository;

import com.visionbox.modules.financeiro.domain.ContaReceberPagamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório do histórico de baixas de Conta a Receber — multi-tenant por loja_id (R1/ADR-001).
 */
public interface ContaReceberPagamentoRepository extends JpaRepository<ContaReceberPagamento, UUID> {

    Optional<ContaReceberPagamento> findByIdAndLojaId(UUID id, UUID lojaId);

    /**
     * Estorno (R1): escopo composto — pagamento da loja E da conta indicada no path.
     * Pagamento de outra loja/conta → Optional.empty → 404 (não vaza existência).
     * Linhas já estornadas (ativo=false) ficam invisíveis pelo @SQLRestriction.
     */
    Optional<ContaReceberPagamento> findByIdAndLojaIdAndContaReceberId(UUID id, UUID lojaId, UUID contaReceberId);

    List<ContaReceberPagamento> findByLojaIdAndContaReceberIdOrderByDataPagamentoAsc(UUID lojaId, UUID contaReceberId);

    /**
     * §3.3 métricas do hub (V41) — total efetivamente recebido no período: SUM(valor_pago)
     * das linhas ATIVAS de baixa (linhas estornadas ficam de fora via @SQLRestriction).
     * Intervalo semiaberto [inicio, fim) em timestamptz. R1: escopo loja_id. SUM no banco.
     * Nota (D-021): soma o dinheiro recebido por linha; juros ficam em coluna própria.
     */
    @Query("select coalesce(sum(p.valorPago), 0) from ContaReceberPagamento p "
            + "where p.lojaId = :lojaId and p.dataPagamento >= :inicio and p.dataPagamento < :fim")
    BigDecimal sumValorPagoByLojaIdAndPeriodo(@Param("lojaId") UUID lojaId,
                                              @Param("inicio") OffsetDateTime inicio,
                                              @Param("fim") OffsetDateTime fim);
}
