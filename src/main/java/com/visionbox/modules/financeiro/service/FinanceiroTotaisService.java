package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.dto.FinanceiroTotaisResponse;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberPagamentoRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * FinanceiroTotaisService — métricas agregadas do topo do hub Financeiro (§3.3, V41).
 * <p>
 * Substitui o cálculo client-side sobre uma página size=100: todas as somas são
 * SUM direto no banco via queries do repositório (R1 — todo @Query escopa loja_id
 * via TenantContext; CANCELADO excluído). Títulos parcialmente pagos contribuem
 * apenas com o valor em aberto — nunca com o valor total.
 * <p>
 * Período: dataInicio/dataFim (yyyy-MM-dd) sobre o VENCIMENTO dos títulos a
 * receber/pagar; totalRecebidoPeriodo usa data_pagamento (timestamptz) das linhas
 * de baixa ativas. Sem datas → mês corrente (mesmo fallback da tela).
 * {@code titulosVencidosAteHoje} ignora o período: é sempre "vencimento antes de
 * hoje", a receber + a pagar, valores em aberto.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FinanceiroTotaisService {

    private final ContaReceberRepository contaReceberRepository;
    private final ContaPagarRepository contaPagarRepository;
    private final ContaReceberPagamentoRepository pagamentoRepository;

    @Transactional(readOnly = true)
    public FinanceiroTotaisResponse totais(LocalDate dataInicio, LocalDate dataFim) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        LocalDate hoje = LocalDate.now();
        LocalDate inicio = dataInicio != null ? dataInicio : hoje.withDayOfMonth(1);
        LocalDate fim = dataFim != null ? dataFim : hoje.withDayOfMonth(hoje.lengthOfMonth());

        BigDecimal aReceber = escala(contaReceberRepository
                .sumValorAbertoByLojaIdAndVencimentoBetween(lojaId, inicio, fim));
        BigDecimal aPagar = escala(contaPagarRepository
                .sumSaldoAbertoByLojaIdAndVencimentoBetween(lojaId, inicio, fim));
        BigDecimal vencidos = escala(contaReceberRepository.sumValorAbertoVencidosAte(lojaId, hoje)
                .add(contaPagarRepository.sumSaldoAbertoVencidosAte(lojaId, hoje)));
        BigDecimal recebido = escala(pagamentoRepository.sumValorPagoByLojaIdAndPeriodo(
                lojaId, inicioDateTime(inicio), inicioDateTime(fim.plusDays(1))));

        log.debug("Financeiro totais loja={} periodo={}..{} aReceber={} aPagar={} vencidos={} recebido={}",
                lojaId, inicio, fim, aReceber, aPagar, vencidos, recebido);

        return FinanceiroTotaisResponse.builder()
                .totalAReceberPeriodo(aReceber)
                .totalAPagarPeriodo(aPagar)
                .titulosVencidosAteHoje(vencidos)
                .saldoProjetado(aReceber.subtract(aPagar).setScale(2, RoundingMode.HALF_EVEN))
                .totalRecebidoPeriodo(recebido)
                .build();
    }

    /** Início do dia local em timestamptz — data_pagamento é gravado com OffsetDateTime.now(). */
    private static OffsetDateTime inicioDateTime(LocalDate dia) {
        return dia.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    /** SUM de numeric(12,2) pode voltar com escala estendida — normaliza HALF_EVEN 2 casas. */
    private static BigDecimal escala(BigDecimal valor) {
        return valor != null ? valor.setScale(2, RoundingMode.HALF_EVEN) : BigDecimal.ZERO.setScale(2);
    }
}
