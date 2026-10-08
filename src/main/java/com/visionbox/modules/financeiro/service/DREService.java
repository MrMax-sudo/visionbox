package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.dto.DREResponse;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * DREService — Demonstrativo de Resultado do Exercício simplificado (US13).
 * Formula: DRE = receita OS - custo - comissao
 * <p>
 * Escopos:
 * - Por loja (padrão): receita = conta_receber e custo = conta_pagar com
 *   vencimento no período. Período default = mês atual (contrato legado mantido).
 * - Por OS (osId): receita = conta_receber.ordem_servico_id = osId; custo =
 *   conta_pagar.ordem_servico_id = osId (vínculo V29 — opcional, custo geral da
 *   loja fica de fora do DRE da OS). Sem período explícito, considera TODA a OS.
 * - Período: "YYYY-MM" (mês) ou "YYYY-MM-DD..YYYY-MM-DD" (intervalo), via
 *   parâmetro {@code periodo}; incompatível com inicio/fim no mesmo request.
 * <p>
 * Receita: soma valor de conta_receber não CANCELADO no período.
 * Custo: soma valor de conta_pagar não CANCELADO no período.
 * Comissão: receita * taxa (default 5%, aceita 0.05 ou 5); se taxa=0 e existir
 * conta_pagar com fornecedor contendo COMISSAO, usa a soma dessas.
 * Multi-tenant obrigatório: toda query filtra por loja_id via TenantContext
 * (param lojaId só é aceito se igual ao tenant autenticado — R1 / ADR-001).
 * Escala monetária: HALF_EVEN 2 casas, margem percentual com 2 casas.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DREService {

    /** Limites usados quando o DRE por OS não informa período (query scoped por OS). */
    private static final LocalDate SEM_INICIO = LocalDate.of(1900, 1, 1);
    private static final LocalDate SEM_FIM = LocalDate.of(2999, 12, 31);

    private static final Pattern PERIODO_MES = Pattern.compile("(\\d{4})-(\\d{2})");
    private static final Pattern PERIODO_INTERVALO = Pattern.compile("(\\d{4}-\\d{2}-\\d{2})\\.\\.(\\d{4}-\\d{2}-\\d{2})");
    private static final String PERIODO_INVALIDO_MSG =
            "periodo inválido: use YYYY-MM ou YYYY-MM-DD..YYYY-MM-DD (ex: 2026-10 ou 2026-01-01..2026-03-31)";

    private final ContaReceberRepository contaReceberRepository;
    private final ContaPagarRepository contaPagarRepository;

    /** Contrato legado preservado: DRE por loja no período inicio..fim, taxa default 5%. */
    @Transactional(readOnly = true)
    public DREResponse calcular(LocalDate inicio, LocalDate fim, BigDecimal taxaComissao) {
        return calcular(null, null, inicio, fim, taxaComissao, null);
    }

    /**
     * DRE com escopo completo (US13).
     *
     * @param lojaSolicitada filtro opcional; deve ser igual ao tenant autenticado (senão 400).
     * @param osId           filtro por OS; null = DRE por loja.
     * @param inicio         início do vencimento (ignorado se periodo informado).
     * @param fim            fim do vencimento (ignorado se periodo informado).
     * @param taxaComissao   percentual (0.05 ou 5); null = 5%.
     * @param periodo        "YYYY-MM" ou "YYYY-MM-DD..YYYY-MM-DD"; mutuamente exclusivo com inicio/fim.
     */
    @Transactional(readOnly = true)
    public DREResponse calcular(UUID lojaSolicitada, UUID osId, LocalDate inicio, LocalDate fim,
                                BigDecimal taxaComissao, String periodo) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (lojaSolicitada != null && !lojaSolicitada.equals(lojaId)) {
            throw new IllegalArgumentException(
                    "lojaId informado diverge do tenant autenticado (" + lojaId + "). DRE é sempre da loja do contexto.");
        }
        if (periodo != null && !periodo.isBlank() && (inicio != null || fim != null)) {
            throw new IllegalArgumentException("informe periodo OU inicio/fim, não ambos");
        }

        Periodo mes = null;
        String periodoEtiqueta = null;
        LocalDate ini;
        LocalDate fimEfetivo;
        boolean semFiltroPeriodo = false;

        if (periodo != null && !periodo.isBlank()) {
            mes = parsePeriodo(periodo.trim());
            periodoEtiqueta = periodo.trim();
        }

        if (osId != null) {
            ini = inicio != null ? inicio : (mes != null ? mes.inicio() : SEM_INICIO);
            fimEfetivo = fim != null ? fim : (mes != null ? mes.fim() : SEM_FIM);
            semFiltroPeriodo = mes == null && inicio == null && fim == null;
        } else if (mes != null) {
            ini = mes.inicio();
            fimEfetivo = mes.fim();
        } else {
            LocalDate hoje = LocalDate.now();
            ini = inicio != null ? inicio : hoje.withDayOfMonth(1);
            fimEfetivo = fim != null ? fim : hoje;
        }
        if (fimEfetivo.isBefore(ini)) {
            throw new IllegalArgumentException("fim deve ser >= inicio");
        }

        List<ContaReceber> contasReceber = osId != null
                ? contaReceberRepository.findByLojaIdAndOrdemServicoIdAndVencimentoBetween(lojaId, osId, ini, fimEfetivo)
                : contaReceberRepository.findByLojaIdAndVencimentoBetween(lojaId, ini, fimEfetivo);
        List<ContaPagar> contasPagar = osId != null
                ? contaPagarRepository.findByLojaIdAndOrdemServicoIdAndVencimentoBetween(lojaId, osId, ini, fimEfetivo)
                : contaPagarRepository.findByLojaIdAndVencimentoBetween(lojaId, ini, fimEfetivo);

        BigDecimal receita = contasReceber.stream()
                .filter(cr -> cr.getStatus() != ContaReceber.StatusConta.CANCELADO)
                .map(cr -> cr.getValor() != null ? cr.getValor() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_EVEN);

        BigDecimal custo = contasPagar.stream()
                .filter(cp -> cp.getStatus() != ContaPagar.StatusContaPagar.CANCELADO)
                .map(cp -> cp.getValor() != null ? cp.getValor() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_EVEN);

        BigDecimal taxa = normalizarTaxa(taxaComissao);
        BigDecimal comissaoCalculada = receita.multiply(taxa).setScale(2, RoundingMode.HALF_EVEN);
        // Comissão extra: contas a pagar com fornecedor COMISSAO (usada apenas quando taxa = 0)
        BigDecimal comissaoExtra = contasPagar.stream()
                .filter(cp -> cp.getFornecedor() != null && cp.getFornecedor().toUpperCase().contains("COMISSAO"))
                .filter(cp -> cp.getStatus() != ContaPagar.StatusContaPagar.CANCELADO)
                .map(cp -> cp.getValor() != null ? cp.getValor() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_EVEN);

        BigDecimal comissao = (taxa.compareTo(BigDecimal.ZERO) == 0 && comissaoExtra.compareTo(BigDecimal.ZERO) > 0)
                ? comissaoExtra
                : comissaoCalculada;

        BigDecimal dre = receita.subtract(custo).subtract(comissao).setScale(2, RoundingMode.HALF_EVEN);

        BigDecimal margem = BigDecimal.ZERO;
        if (receita.compareTo(BigDecimal.ZERO) != 0) {
            margem = dre.divide(receita, 4, RoundingMode.HALF_EVEN)
                    .multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_EVEN);
        }

        long totalReceber = contasReceber.stream()
                .filter(cr -> cr.getStatus() != ContaReceber.StatusConta.CANCELADO).count();
        long totalPagar = contasPagar.stream()
                .filter(cp -> cp.getStatus() != ContaPagar.StatusContaPagar.CANCELADO).count();

        String observacao = "DRE = receita OS (" + receita + ") - custo (" + custo + ") - comissao (" + comissao
                + " taxa " + taxa.multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_EVEN) + "%)";
        if (osId != null) {
            observacao = observacao + " | escopo=OS " + osId;
        }
        if (periodoEtiqueta != null) {
            observacao = observacao + " | periodo=" + periodoEtiqueta;
        }

        log.info("DRE loja={} os={} periodo={} receita={} custo={} comissao={} taxa={} dre={} margem={}%",
                lojaId, osId,
                semFiltroPeriodo ? "sem filtro de período" : ini + ".." + fimEfetivo,
                receita, custo, comissao, taxa, dre, margem);

        // inicio/fim da resposta refletem apenas o que foi informado (nunca expõe
        // limites artificiais 1900/2999 usados internamente no DRE por OS sem período)
        LocalDate iniResp = semFiltroPeriodo ? null : (mes != null || inicio != null || osId == null ? ini : null);
        LocalDate fimResp = semFiltroPeriodo ? null : (mes != null || fim != null || osId == null ? fimEfetivo : null);

        return DREResponse.builder()
                .lojaId(lojaId)
                .inicio(iniResp)
                .fim(fimResp)
                .receita(receita)
                .custo(custo)
                .comissao(comissao)
                .dre(dre)
                .observacao(observacao)
                .margemPercentual(margem)
                .totalContasReceber(totalReceber)
                .totalContasPagar(totalPagar)
                .osId(osId)
                .periodo(periodoEtiqueta)
                .build();
    }

    /** Atalho para relatório mensal: DRE do mês atual com taxa padrão 5%. */
    @Transactional(readOnly = true)
    public DREResponse calcularMesAtual() {
        LocalDate ini = LocalDate.now().withDayOfMonth(1);
        LocalDate fim = LocalDate.now();
        return calcular(ini, fim, null);
    }

    private BigDecimal normalizarTaxa(BigDecimal taxaComissao) {
        BigDecimal taxa = taxaComissao != null ? taxaComissao : new BigDecimal("0.05");
        // taxa como 0.05 = 5%; se vier 5 (inteiro), normaliza para 0.05
        if (taxa.compareTo(BigDecimal.ONE) > 0) {
            taxa = taxa.divide(new BigDecimal("100"), 4, RoundingMode.HALF_EVEN);
        }
        return taxa.setScale(4, RoundingMode.HALF_EVEN);
    }

    private Periodo parsePeriodo(String periodo) {
        Matcher intervalo = PERIODO_INTERVALO.matcher(periodo);
        if (intervalo.matches()) {
            try {
                LocalDate i = LocalDate.parse(intervalo.group(1));
                LocalDate f = LocalDate.parse(intervalo.group(2));
                if (f.isBefore(i)) {
                    throw new IllegalArgumentException("periodo inválido: fim anterior ao início");
                }
                return new Periodo(i, f);
            } catch (DateTimeParseException e) {
                throw new IllegalArgumentException(PERIODO_INVALIDO_MSG);
            }
        }
        Matcher mes = PERIODO_MES.matcher(periodo);
        if (mes.matches()) {
            try {
                YearMonth ym = YearMonth.of(Integer.parseInt(mes.group(1)), Integer.parseInt(mes.group(2)));
                return new Periodo(ym.atDay(1), ym.atEndOfMonth());
            } catch (DateTimeException | NumberFormatException e) {
                throw new IllegalArgumentException(PERIODO_INVALIDO_MSG);
            }
        }
        throw new IllegalArgumentException(PERIODO_INVALIDO_MSG);
    }

    private record Periodo(LocalDate inicio, LocalDate fim) {
    }
}