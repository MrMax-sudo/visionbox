package com.visionbox.shared.metrics;

import com.visionbox.modules.fiscal.DocumentoFiscal;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.shared.idempotency.OutboxMessage;
import com.visionbox.shared.outbox.OutboxRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * SlaMetrics — métricas de negócio VisionBox (docs/METRICS.md §Métricas Técnicas).
 * <p>
 * Exposição: {@code /actuator/prometheus} (micrometer-registry-prometheus).
 * Nomes conforme docs:
 * <ul>
 *   <li>{@code visionbox_os_atrasadas_total{laboratorio}} — gauge</li>
 *   <li>{@code visionbox_outbox_pendente} — gauge (PENDING + FAILED)</li>
 *   <li>{@code visionbox_fiscal_contingencia_pendente} — gauge (CONTINGENCIA)</li>
 *   <li>{@code visionbox_lab_leadtime_seconds} — timer com p50/p95 (ENVIADO/PEDIDO → PRONTO_PARA_RETIRADA)</li>
 *   <li>{@code visionbox_os_em_producao} — gauge (status EM_PRODUCAO)</li>
 * </ul>
 * Multi-instância: o refresh agendado roda em toda instância — grava os mesmos valores
 * (consultas globais, independem de tenant), logo a sobreposição é inofensiva.
 * Timing: {@code fixedDelay=30s} com {@code initialDelay=10s} — nunca executa SELECT no
 * thread de scrape; o scrape lê apenas os AtomicLong em memória.
 */
@Component
public class SlaMetrics {

    private static final Logger log = LoggerFactory.getLogger(SlaMetrics.class);
    private static final long FIXED_DELAY_MS = 30_000;
    private static final long INITIAL_DELAY_MS = 10_000;
    /** Mesmos terminais de SlaService: status que NÃO contam como atrasado. */
    private static final Set<StatusOS> STATUS_TERMINAIS = Set.of(
            StatusOS.ENTREGUE,
            StatusOS.CANCELADO,
            StatusOS.DEVOLVIDO_GARANTIA
    );
    private static final String LAB_SEM_LABORATORIO = "nenhum";

    private final MeterRegistry registry;
    private final OrdemServicoRepository ordemServicoRepository;
    private final OutboxRepository outboxRepository;
    private final DocumentoFiscalRepository documentoFiscalRepository;
    private final Clock clock;

    // Strong references impedem GC dos meters (Micrometer não segura referência forte).
    private final java.util.Map<String, AtomicLong> atrasadasPorLaboratorio = new ConcurrentHashMap<>();
    private final AtomicLong outboxPendente = new AtomicLong();
    private final AtomicLong fiscalContingenciaPendente = new AtomicLong();
    private final AtomicLong osEmProducao = new AtomicLong();
    private final java.util.Map<String, Timer> leadTimePorLaboratorio = new ConcurrentHashMap<>();

    public SlaMetrics(MeterRegistry registry,
                      OrdemServicoRepository ordemServicoRepository,
                      OutboxRepository outboxRepository,
                      DocumentoFiscalRepository documentoFiscalRepository,
                      Clock clock) {
        this.registry = registry;
        this.ordemServicoRepository = ordemServicoRepository;
        this.outboxRepository = outboxRepository;
        this.documentoFiscalRepository = documentoFiscalRepository;
        this.clock = clock;

        Gauge.builder("visionbox_outbox_pendente", outboxPendente, AtomicLong::get)
                .description("Mensagens outbox PENDING/FAILED aguardando publicação (R4 — nunca perder evento offline)")
                .register(registry);
        Gauge.builder("visionbox_fiscal_contingencia_pendente", fiscalContingenciaPendente, AtomicLong::get)
                .description("Documentos fiscais em CONTINGENCIA aguardando sincronização quando a rede voltar")
                .register(registry);
        Gauge.builder("visionbox_os_em_producao", osEmProducao, AtomicLong::get)
                .description("OS no status EM_PRODUCAO (carga atual do laboratório)")
                .register(registry);
    }

    /**
     * Refresh agendado das gauges (leitura de DB fora do caminho de scrape).
     */
    @Scheduled(fixedDelay = FIXED_DELAY_MS, initialDelay = INITIAL_DELAY_MS)
    public void atualizarGauges() {
        OffsetDateTime agora = OffsetDateTime.now(clock);
        try {
            osEmProducao.set(ordemServicoRepository.countByStatus(StatusOS.EM_PRODUCAO));
            outboxPendente.set(outboxRepository.countByStatusIn(
                    List.of(OutboxMessage.Status.PENDING, OutboxMessage.Status.FAILED)));
            fiscalContingenciaPendente.set(
                    documentoFiscalRepository.countByStatus(DocumentoFiscal.StatusFiscal.CONTINGENCIA));
            atualizarAtrasadas(agora);
        } catch (Exception e) {
            log.warn("SlaMetrics.atualizarGauges falhou: {}", e.getMessage(), e);
        }
    }

    /**
     * OS atrasadas = previsao_entrega &lt; agora AND status NOT IN terminais, agrupado por laboratório.
     * Laboratório ausente (OS ainda sem envio) entra como tag "nenhum".
     */
    private void atualizarAtrasadas(OffsetDateTime agora) {
        List<Object[]> rows = ordemServicoRepository.countAtrasadasPorLaboratorio(agora, STATUS_TERMINAIS);
        Set<String> labsComValor = new HashSet<>();
        for (Object[] row : rows) {
            UUID laboratorioId = (UUID) row[0];
            long quantidade = ((Number) row[1]).longValue();
            String lab = laboratorioId != null ? laboratorioId.toString() : LAB_SEM_LABORATORIO;
            labsComValor.add(lab);
            gaugeAtrasadas(lab).set(quantidade);
        }
        // Laboratórios que deixaram de ter atraso precisam voltar a 0 (gauge não zera sozinho).
        for (String lab : atrasadasPorLaboratorio.keySet()) {
            if (!labsComValor.contains(lab)) {
                atrasadasPorLaboratorio.get(lab).set(0L);
            }
        }
    }

    private AtomicLong gaugeAtrasadas(String laboratorio) {
        return atrasadasPorLaboratorio.computeIfAbsent(laboratorio, lab -> {
            AtomicLong valor = new AtomicLong();
            Gauge.builder("visionbox_os_atrasadas_total", valor, AtomicLong::get)
                    .tag("laboratorio", lab)
                    .description("OS atrasadas (previsao_entrega < agora, status não terminal) por laboratório")
                    .register(registry);
            return valor;
        });
    }

    /**
     * Registra lead time do laboratório (SLA Lab): janela ENVIADO_LABORATORIO (ou
     * PEDIDO_CONFIRMADO como fallback) → PRONTO_PARA_RETIRADA. Chamado pelo
     * OrdemServicoService na transição; durações fora do intervalo normal são descartadas.
     */
    public void registrarLeadTimeLaboratorio(UUID laboratorioId, Duration duracao) {
        if (laboratorioId == null || duracao == null || duracao.isNegative() || duracao.isZero()) {
            log.debug("Lead time ignorado laboratorio={} duracao={}", laboratorioId, duracao);
            return;
        }
        if (duracao.toDays() > 90) {
            log.debug("Lead time fora do intervalo normal laboratorio={} dias={}", laboratorioId, duracao.toDays());
            return;
        }
        String lab = laboratorioId.toString();
        Timer timer = leadTimePorLaboratorio.computeIfAbsent(lab, k -> Timer.builder("visionbox_lab_leadtime")
                .tag("laboratorio", k)
                .publishPercentiles(0.5, 0.95)
                .description("Lead time OS (ENVIADO_LABORATORIO/PEDIDO_CONFIRMADO → PRONTO_PARA_RETIRADA) em segundos")
                .register(registry));
        timer.record(duracao);
    }
}