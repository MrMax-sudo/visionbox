package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.domain.ConciliacaoOfx;
import com.visionbox.modules.financeiro.domain.ConciliacaoOfx.StatusConciliacao;
import com.visionbox.modules.financeiro.domain.ConciliacaoOfx.TipoContaConciliacao;
import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.dto.ConciliacaoOfxResponse;
import com.visionbox.modules.financeiro.dto.OfxImportarRequest;
import com.visionbox.modules.financeiro.dto.OfxImportarResponse;
import com.visionbox.modules.financeiro.mapper.ConciliacaoOfxMapper;
import com.visionbox.modules.financeiro.repository.ConciliacaoOfxRepository;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * OfxConciliacaoService — importação e conciliação de extrato OFX (US13).
 * <p>
 * Conciliação por linha:
 * 1. Dedup: FITID único por loja — FITID já importado (banco ou mesmo arquivo) é
 *    pulado como {@code duplicado} e nunca grava 2ª linha.
 * 2. Match exato: conta (receber p/ crédito, pagar p/ débito) com o MESMO valor
 *    e data (vencimento OU data_pagamento) dentro da tolerância de dias → CONCILIADO.
 * 3. Divergente: candidata na janela de datas (± tolerância) ou mesmo valor
 *    sem encaixe exato → DIVERGENTE com {@code diferenca_valor} e vínculo.
 * 4. Sem candidata → PENDENTE.
 * <p>
 * Conciliação é EVIDÊNCIA: não muda status/valorPago da conta (baixa continua
 * em /contas-receber/{id}/baixar e /contas-pagar/{id}/baixar) — evita dupla
 * contagem no DRE. Multi-tenant: toda query por loja_id do TenantContext.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfxConciliacaoService {

    public static final int TOLERANCIA_PADRAO_DIAS = 3;

    private final ConciliacaoOfxRepository conciliacaoRepository;
    private final ContaReceberRepository contaReceberRepository;
    private final ContaPagarRepository contaPagarRepository;
    private final ConciliacaoOfxMapper mapper;

    @Transactional
    public OfxImportarResponse importar(OfxImportarRequest request) {
        return importarConteudo(request.getConteudo(), request.getToleranciaDias(), request.getConciliar());
    }

    @Transactional
    public OfxImportarResponse importarConteudo(String conteudo, Integer toleranciaDias, Boolean conciliar) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (conteudo == null || conteudo.isBlank()) {
            throw new BusinessException("Conteúdo OFX vazio — envie o extrato em texto (OFX até 3.x).");
        }
        int tolerancia = toleranciaDias != null ? toleranciaDias : TOLERANCIA_PADRAO_DIAS;
        boolean comConciliacao = conciliar == null || conciliar;

        OfxParser.Resultado parse = OfxParser.parse(conteudo);
        if (parse.transacoes().isEmpty()) {
            throw new BusinessException("OFX inválido: nenhuma transação válida em <STMTTRN>. " + resumoErros(parse.erros()));
        }

        // Contas já CONCILIADAS na loja não são reconciliadas (evita rematch duplicado)
        Set<UUID> receberUsadas = new HashSet<>(
                conciliacaoRepository.findIdsContaReceberConciliadas(lojaId, StatusConciliacao.CONCILIADO));
        Set<UUID> pagarUsadas = new HashSet<>(
                conciliacaoRepository.findIdsContaPagarConciliadas(lojaId, StatusConciliacao.CONCILIADO));
        Set<String> fitIdsLote = new HashSet<>();

        int importados = 0;
        int duplicados = 0;
        int conciliados = 0;
        int divergentes = 0;
        int pendentes = 0;

        for (OfxParser.Transacao t : parse.transacoes()) {
            if (!fitIdsLote.add(t.fitId()) || conciliacaoRepository.existsByLojaIdAndFitId(lojaId, t.fitId())) {
                duplicados++;
                continue;
            }
            Match match = comConciliacao
                    ? conciliar(lojaId, t, tolerancia, receberUsadas, pagarUsadas)
                    : Match.pendente("Importação sem conciliação (conciliar=false)");

            ConciliacaoOfx entidade = ConciliacaoOfx.builder()
                    .lojaId(lojaId)
                    .fitId(t.fitId())
                    .trnTipo(t.trnTipo())
                    .dataPostamento(t.dataPostamento())
                    .valor(t.valor())
                    .memo(t.memo())
                    .status(match.status())
                    .tipoConta(match.tipo())
                    .contaReceberId(match.contaReceberId())
                    .contaPagarId(match.contaPagarId())
                    .diferencaValor(match.diferenca())
                    .observacao(match.observacao())
                    .build();
            entidade.normalizarValor();
            conciliacaoRepository.save(entidade);
            importados++;

            switch (match.status()) {
                case CONCILIADO -> {
                    conciliados++;
                    if (match.contaReceberId() != null) receberUsadas.add(match.contaReceberId());
                    if (match.contaPagarId() != null) pagarUsadas.add(match.contaPagarId());
                }
                case DIVERGENTE -> divergentes++;
                case PENDENTE -> pendentes++;
            }
        }

        log.info("OFX loja={} total={} importados={} duplicados={} conciliados={} divergentes={} pendentes={} erros={}",
                lojaId, parse.transacoes().size(), importados, duplicados, conciliados, divergentes, pendentes, parse.erros().size());

        return OfxImportarResponse.builder()
                .totalTransacoes(parse.transacoes().size())
                .importados(importados)
                .duplicados(duplicados)
                .conciliados(conciliados)
                .divergentes(divergentes)
                .pendentes(pendentes)
                .erros(parse.erros())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<ConciliacaoOfxResponse> listar(String status, LocalDate inicio, LocalDate fim, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            throw new IllegalArgumentException("fim deve ser >= inicio");
        }
        StatusConciliacao st = null;
        if (status != null && !status.isBlank()) {
            st = StatusConciliacao.valueOf(status.trim().toUpperCase());
        }
        Page<ConciliacaoOfx> page;
        if (st != null && inicio != null && fim != null) {
            page = conciliacaoRepository.findByLojaIdAndStatusAndDataPostamentoBetween(lojaId, st, inicio, fim, pageable);
        } else if (st != null) {
            page = conciliacaoRepository.findByLojaIdAndStatus(lojaId, st, pageable);
        } else if (inicio != null && fim != null) {
            page = conciliacaoRepository.findByLojaIdAndDataPostamentoBetween(lojaId, inicio, fim, pageable);
        } else {
            page = conciliacaoRepository.findByLojaId(lojaId, pageable);
        }
        return page.map(mapper::toResponse);
    }

    // ---------------------------------------------------------------------
    // Matching
    // ---------------------------------------------------------------------

    private Match conciliar(UUID lojaId, OfxParser.Transacao t, int tolerancia,
                            Set<UUID> receberUsadas, Set<UUID> pagarUsadas) {
        boolean credito = t.valor().compareTo(BigDecimal.ZERO) >= 0;
        BigDecimal alvo = t.valor().abs().setScale(2, RoundingMode.HALF_EVEN);
        LocalDate base = t.dataPostamento();
        return credito
                ? conciliarReceber(lojaId, base, alvo, tolerancia, receberUsadas)
                : conciliarPagar(lojaId, base, alvo, tolerancia, pagarUsadas);
    }

    private Match conciliarReceber(UUID lojaId, LocalDate base, BigDecimal alvo, int tolerancia, Set<UUID> usadas) {
        List<ContaReceber> porValor = contaReceberRepository
                .findByLojaIdAndValorAndStatusNot(lojaId, alvo, ContaReceber.StatusConta.CANCELADO)
                .stream().filter(c -> !usadas.contains(c.getId())).toList();

        Optional<ContaReceber> exata = porValor.stream()
                .min(Comparator.comparingLong(c -> distanciaDias(c, base)));
        if (exata.isPresent()) {
            long dist = distanciaDias(exata.get(), base);
            if (dist <= tolerancia) {
                String obs = dist == 0
                        ? "Conciliado por valor e data (mesmo dia)"
                        : "Conciliado por valor e data (distância " + dist + " dia(s))";
                return Match.conciliado(TipoContaConciliacao.RECEBER, exata.get().getId(), null, obs);
            }
        }

        Optional<ContaReceber> divergente = candidatasDivergentesReceber(lojaId, base, alvo, tolerancia, usadas)
                .stream().min(comparadorDivergente(base, alvo, ContaReceber::getValor));
        if (divergente.isPresent()) {
            ContaReceber c = divergente.get();
            BigDecimal dif = alvo.subtract(valorOuZero(c.getValor())).setScale(2, RoundingMode.HALF_EVEN);
            return Match.divergente(TipoContaConciliacao.RECEBER, c.getId(), null, dif,
                    "Divergente: conta receber " + c.getId() + " dif " + dif.toPlainString());
        }
        return Match.pendente("Sem correspondência em conta_receber");
    }

    private Match conciliarPagar(UUID lojaId, LocalDate base, BigDecimal alvo, int tolerancia, Set<UUID> usadas) {
        List<ContaPagar> porValor = contaPagarRepository
                .findByLojaIdAndValorAndStatusNot(lojaId, alvo, ContaPagar.StatusContaPagar.CANCELADO)
                .stream().filter(c -> !usadas.contains(c.getId())).toList();

        Optional<ContaPagar> exata = porValor.stream()
                .min(Comparator.comparingLong(c -> distanciaDias(c, base)));
        if (exata.isPresent()) {
            long dist = distanciaDias(exata.get(), base);
            if (dist <= tolerancia) {
                String obs = dist == 0
                        ? "Conciliado por valor e data (mesmo dia)"
                        : "Conciliado por valor e data (distância " + dist + " dia(s))";
                return Match.conciliado(TipoContaConciliacao.PAGAR, null, exata.get().getId(), obs);
            }
        }

        Optional<ContaPagar> divergente = candidatasDivergentesPagar(lojaId, base, alvo, tolerancia, usadas)
                .stream().min(comparadorDivergente(base, alvo, ContaPagar::getValor));
        if (divergente.isPresent()) {
            ContaPagar c = divergente.get();
            BigDecimal dif = alvo.subtract(valorOuZero(c.getValor())).setScale(2, RoundingMode.HALF_EVEN);
            return Match.divergente(TipoContaConciliacao.PAGAR, null, c.getId(), dif,
                    "Divergente: conta pagar " + c.getId() + " dif " + dif.toPlainString());
        }
        return Match.pendente("Sem correspondência em conta_pagar");
    }

    /** Candidatas divergentes: mesma janela de datas (± tolerância) ou mesmo valor. */
    private List<ContaReceber> candidatasDivergentesReceber(UUID lojaId, LocalDate base, BigDecimal alvo,
                                                            int tolerancia, Set<UUID> usadas) {
        List<ContaReceber> porValor = contaReceberRepository
                .findByLojaIdAndValorAndStatusNot(lojaId, alvo, ContaReceber.StatusConta.CANCELADO);
        List<ContaReceber> porData = contaReceberRepository.findByLojaIdAndVencimentoBetween(
                lojaId, base.minusDays(tolerancia), base.plusDays(tolerancia));
        List<ContaReceber> candidatas = new ArrayList<>(porData);
        for (ContaReceber c : porValor) {
            if (candidatas.stream().noneMatch(x -> x.getId().equals(c.getId()))) {
                candidatas.add(c);
            }
        }
        return candidatas.stream()
                .filter(c -> c.getStatus() != ContaReceber.StatusConta.CANCELADO)
                .filter(c -> !usadas.contains(c.getId()))
                .toList();
    }

    private List<ContaPagar> candidatasDivergentesPagar(UUID lojaId, LocalDate base, BigDecimal alvo,
                                                        int tolerancia, Set<UUID> usadas) {
        List<ContaPagar> porValor = contaPagarRepository
                .findByLojaIdAndValorAndStatusNot(lojaId, alvo, ContaPagar.StatusContaPagar.CANCELADO);
        List<ContaPagar> porData = contaPagarRepository.findByLojaIdAndVencimentoBetween(
                lojaId, base.minusDays(tolerancia), base.plusDays(tolerancia));
        List<ContaPagar> candidatas = new ArrayList<>(porData);
        for (ContaPagar c : porValor) {
            if (candidatas.stream().noneMatch(x -> x.getId().equals(c.getId()))) {
                candidatas.add(c);
            }
        }
        return candidatas.stream()
                .filter(c -> c.getStatus() != ContaPagar.StatusContaPagar.CANCELADO)
                .filter(c -> !usadas.contains(c.getId()))
                .toList();
    }

    /** Preferência: data mais próxima; empate usa menor diferença de valor. */
    private <T> java.util.Comparator<T> comparadorDivergente(LocalDate base, BigDecimal alvo,
                                                             java.util.function.Function<T, BigDecimal> getValor) {
        return (a, b) -> {
            int cmp = Long.compare(distanciaDias(a, base), distanciaDias(b, base));
            if (cmp != 0) return cmp;
            BigDecimal da = alvo.subtract(valorOuZero(getValor.apply(a))).abs();
            BigDecimal db = alvo.subtract(valorOuZero(getValor.apply(b))).abs();
            return da.compareTo(db);
        };
    }

    /** Distância em dias entre DTPOSTED e vencimento OU data_pagamento (a menor). */
    private <T> long distanciaDias(T conta, LocalDate base) {
        if (conta instanceof ContaReceber cr) {
            return distanciaDias(cr.getVencimento(), cr.getDataPagamento() != null ? cr.getDataPagamento().toLocalDate() : null, base);
        }
        if (conta instanceof ContaPagar cp) {
            return distanciaDias(cp.getVencimento(), cp.getDataPagamento() != null ? cp.getDataPagamento().toLocalDate() : null, base);
        }
        return Long.MAX_VALUE;
    }

    private long distanciaDias(LocalDate vencimento, LocalDate dataPagamento, LocalDate base) {
        long diasVenc = vencimento != null ? Math.abs(ChronoUnit.DAYS.between(vencimento, base)) : Long.MAX_VALUE;
        if (dataPagamento == null) {
            return diasVenc;
        }
        long diasPag = Math.abs(ChronoUnit.DAYS.between(dataPagamento, base));
        return Math.min(diasVenc, diasPag);
    }

    private static BigDecimal valorOuZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static String resumoErros(List<String> erros) {
        if (erros == null || erros.isEmpty()) {
            return "";
        }
        return erros.size() <= 3
                ? String.join("; ", erros)
                : String.join("; ", erros.subList(0, 3)) + " (+" + (erros.size() - 3) + " erros)";
    }

    private record Match(StatusConciliacao status, TipoContaConciliacao tipo,
                         UUID contaReceberId, UUID contaPagarId,
                         BigDecimal diferenca, String observacao) {
        static Match conciliado(TipoContaConciliacao tipo, UUID receber, UUID pagar, String obs) {
            return new Match(StatusConciliacao.CONCILIADO, tipo, receber, pagar, BigDecimal.ZERO, obs);
        }

        static Match divergente(TipoContaConciliacao tipo, UUID receber, UUID pagar, BigDecimal dif, String obs) {
            return new Match(StatusConciliacao.DIVERGENTE, tipo, receber, pagar, dif, obs);
        }

        static Match pendente(String obs) {
            return new Match(StatusConciliacao.PENDENTE, null, null, null, null, obs);
        }
    }
}