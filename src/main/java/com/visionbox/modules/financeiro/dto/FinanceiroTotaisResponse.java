package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Métricas agregadas do hub Financeiro (§3.3 — Plano Robustez, V41).
 * Contrato: GET /api/v1/financeiro/totais?dataInicio&dataFim — somas feitas no
 * banco (SUM no repositório, sem carregar páginas; fim da limitação size=100 da
 * tela). Todas em BigDecimal escala 2 (numeric(12,2)).
 * <p>
 * Semântica dos campos:
 * <ul>
 *   <li>{@code totalAReceberPeriodo} — soma do VALOR EM ABERTO (não do valor total)
 *       dos títulos a receber com vencimento em [dataInicio, dataFim]. Exclui
 *       CANCELADO. Título parcialmente pago soma apenas o saldo restante.</li>
 *   <li>{@code totalAPagarPeriodo} — idem para contas a pagar (valor - valor_pago).</li>
 *   <li>{@code titulosVencidosAteHoje} — soma do valor em aberto de títulos a receber
 *       E a pagar com vencimento ANTES de hoje (independe do período filtrado —
 *       "até hoje" fixo). Exclui CANCELADO.</li>
 *   <li>{@code saldoProjetado} — totalAReceberPeriodo − totalAPagarPeriodo.</li>
 *   <li>{@code totalRecebidoPeriodo} — soma de valor_pago das linhas ATIVAS de
 *       conta_receber_pagamento com data_pagamento no período (contexto p/ DRE;
 *       baixas estornadas não contam). Juros (V41) são registrados à parte na linha.</li>
 * </ul>
 * Sem dataInicio/dataFim → mês corrente (fallback igual ao da tela). R1: escopo loja.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FinanceiroTotaisResponse {

    private BigDecimal totalAReceberPeriodo;
    private BigDecimal totalAPagarPeriodo;
    private BigDecimal titulosVencidosAteHoje;
    private BigDecimal saldoProjetado;
    private BigDecimal totalRecebidoPeriodo;
}
