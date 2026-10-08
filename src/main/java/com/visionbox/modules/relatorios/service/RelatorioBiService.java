package com.visionbox.modules.relatorios.service;

import com.visionbox.modules.relatorios.dto.CurvaAbcItemResponse;
import com.visionbox.modules.relatorios.dto.CurvaAbcResponse;
import com.visionbox.modules.relatorios.dto.GiroProdutoResponse;
import com.visionbox.modules.relatorios.dto.MargemVendedorResponse;
import com.visionbox.modules.relatorios.repository.AbcProdutoProjection;
import com.visionbox.modules.relatorios.repository.GiroProdutoProjection;
import com.visionbox.modules.relatorios.repository.MargemOsProjection;
import com.visionbox.modules.relatorios.repository.RelatorioBiRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * RelatorioBiService — BI US16 (giro de produtos, margem por vendedor, curva ABC).
 * <p>
 * Multi-tenant obrigatório: o lojaId vem do {@link TenantContext} (preenchido pelo
 * TenantFilter via JWT/header) e é passado a TODAS as queries do repositório —
 * nunca um findById sem lojaId (R1 / ADR-001).
 * <p>
 * Período: {@code dataInicio}/{@code dataFim} (LocalDate). Default mês atual
 * (mesmo comportamento do DRE). Intervalo convertido para timestamptz com fuso
 * América/São_Paulo; {@code fimExclusivo = dataFim + 1 dia às 00:00}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RelatorioBiService {

    /** Fuso comercial das lojas (Brasil) — conversão do período data→timestamptz. */
    static final ZoneId ZONE_BI = ZoneId.of("America/Sao_Paulo");

    private final RelatorioBiRepository repository;

    @Transactional(readOnly = true)
    public Page<GiroProdutoResponse> giroProdutos(LocalDate dataInicio, LocalDate dataFim, Pageable pageable) {
        PeriodoBi periodo = periodo(dataInicio, dataFim);
        Page<GiroProdutoProjection> linhas = repository.rankingGiro(
                periodo.lojaId(), periodo.inicio(), periodo.fimExclusivo(), pageable);
        Page<GiroProdutoResponse> resultado = linhas.map(this::toGiro);
        log.info("BI giro-produtos loja={} periodo={}..{} total={}", periodo.lojaId(), dataInicio, dataFim, resultado.getTotalElements());
        return resultado;
    }

    @Transactional(readOnly = true)
    public Page<MargemVendedorResponse> margemVendedor(LocalDate dataInicio, LocalDate dataFim, Pageable pageable) {
        PeriodoBi periodo = periodo(dataInicio, dataFim);
        List<MargemOsProjection> linhasOs = repository.dadosMargemPorOs(
                periodo.lojaId(), periodo.inicio(), periodo.fimExclusivo());
        List<MargemVendedorResponse> agregado = MargemVendedorAggregator.agregar(linhasOs);
        Page<MargemVendedorResponse> resultado = paginar(agregado, pageable);
        log.info("BI margem-vendedor loja={} periodo={}..{} vendedores={}", periodo.lojaId(), dataInicio, dataFim, resultado.getTotalElements());
        return resultado;
    }

    @Transactional(readOnly = true)
    public CurvaAbcResponse curvaAbc(LocalDate dataInicio, LocalDate dataFim) {
        PeriodoBi periodo = periodo(dataInicio, dataFim);
        List<AbcProdutoProjection> linhas = repository.faturamentoPorProduto(
                periodo.lojaId(), periodo.inicio(), periodo.fimExclusivo());
        List<AbcProduto> produtos = new ArrayList<>(linhas.size());
        for (AbcProdutoProjection linha : linhas) {
            produtos.add(new AbcProduto(linha.getProdutoId(), linha.getProdutoNome(), linha.getSku(),
                    ValoresBi.dinheiro(linha.getFaturamento())));
        }
        List<CurvaAbcItemResponse> itens = CurvaAbcClassifier.classificar(produtos);
        BigDecimal total = itens.stream()
                .map(CurvaAbcItemResponse::getFaturamento)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        CurvaAbcResponse resultado = CurvaAbcResponse.of(total, itens);
        log.info("BI curva-abc loja={} periodo={}..{} total={} itens={}", periodo.lojaId(), dataInicio, dataFim, total, itens.size());
        return resultado;
    }

    // ===== helpers =====

    private PeriodoBi periodo(LocalDate dataInicio, LocalDate dataFim) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        LocalDate ini = dataInicio != null ? dataInicio : LocalDate.now().withDayOfMonth(1);
        LocalDate fim = dataFim != null ? dataFim : LocalDate.now();
        if (fim.isBefore(ini)) {
            throw new IllegalArgumentException("dataFim deve ser >= dataInicio");
        }
        OffsetDateTime inicio = ini.atStartOfDay(ZONE_BI).toOffsetDateTime();
        OffsetDateTime fimExclusivo = fim.plusDays(1).atStartOfDay(ZONE_BI).toOffsetDateTime();
        return new PeriodoBi(lojaId, inicio, fimExclusivo);
    }

    private GiroProdutoResponse toGiro(GiroProdutoProjection linha) {
        return GiroProdutoResponse.builder()
                .produtoId(linha.getProdutoId())
                .produtoNome(linha.getProdutoNome())
                .sku(linha.getSku())
                .tipoProduto(linha.getTipoProduto())
                .quantidadeVendida(linha.getQuantidadeVendida())
                .faturamento(ValoresBi.dinheiro(linha.getFaturamento()))
                .build();
    }

    /** Paginação manual para listas agregadas em memória (margem por vendedor). */
    private <T> Page<T> paginar(List<T> lista, Pageable pageable) {
        int total = lista.size();
        int offset = (int) Math.min(pageable.getOffset(), (long) total);
        int tamanho = Math.min(pageable.getPageSize(), total - offset);
        List<T> conteudo = tamanho > 0 ? lista.subList(offset, offset + tamanho) : new ArrayList<>();
        return new PageImpl<>(conteudo, pageable, total);
    }
}