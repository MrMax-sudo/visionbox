package com.visionbox.modules.ordemservico.service;

import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * SlaService — diferencial VisionBox SLA laboratório.
 * <p>
 * Verifica OS com {@code previsaoEntrega < now() AND status NOT IN (ENTREGUE, CANCELADO, DEVOLVIDO_GARANTIA)}
 * e marca {@code alertaAtrasoDisparado=true} para evitar re-disparo.
 * <p>
 * Job agendado via {@code @Scheduled(fixedDelay=60000)} (1 min).
 * Endpoint: {@code GET /api/v1/ordens-servico/atrasadas} paginado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SlaService {

    private final OrdemServicoRepository repository;
    private final Clock clock;

    /**
     * Status terminais que NÃO são considerados "atrasados" (já finalizados).
     */
    private static final Set<StatusOS> STATUS_TERMINAIS = Set.of(
            StatusOS.ENTREGUE,
            StatusOS.CANCELADO,
            StatusOS.DEVOLVIDO_GARANTIA
    );

    /**
     * Job agendado: roda a cada 60 segundos (fixedDelay = 60000 ms).
     * <p>
     * Busca TODAS as OS atrasadas (todas as lojas) que ainda não tiveram alerta disparado,
     * agrupa por lojaId, seta o contexto de tenant e atualiza {@code alertaAtrasoDisparado=true}.
     * <p>
     * Usa {@code findAtrasadasParaAlerta} e {@code findDistinctLojaIdsComAtraso} do repository
     * para consulta global sem filtro de tenant (job de sistema).
     */
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void verificarAtrasos() {
        OffsetDateTime agora = OffsetDateTime.now(clock);
        log.debug("SlaService.verificarAtrasos iniciado agora={}", agora);

        List<UUID> lojaIdsComAtraso = repository.findDistinctLojaIdsComAtraso(agora, STATUS_TERMINAIS);
        if (lojaIdsComAtraso.isEmpty()) {
            log.debug("SlaService: nenhuma loja com OS atrasada sem alerta");
            return;
        }

        int totalAtualizadas = 0;
        for (UUID lojaId : lojaIdsComAtraso) {
            UUID prev = TenantContext.getCurrentLojaId().orElse(null);
            try {
                TenantContext.setCurrentLojaId(lojaId);
                List<OrdemServico> atrasadas = repository.findAtrasadasParaAlerta(agora, STATUS_TERMINAIS);
                // Filtra apenas as da loja atual (o query global pode trazer de outras lojas se RLS não filtrar)
                List<OrdemServico> destaLoja = atrasadas.stream()
                        .filter(os -> os.getLojaId().equals(lojaId))
                        .toList();

                for (OrdemServico os : destaLoja) {
                    os.setAlertaAtrasoDisparado(true);
                    repository.save(os);
                    log.info("SlaService: alertaAtrasoDisparado=true OS={} loja={} previsao={}", os.getNumero(), lojaId, os.getPrevisaoEntrega());
                    totalAtualizadas++;
                }
            } catch (Exception e) {
                log.error("SlaService: erro ao processar atrasos loja={} erro={}", lojaId, e.getMessage(), e);
            } finally {
                if (prev == null) TenantContext.clear(); else TenantContext.setCurrentLojaId(prev);
            }
        }

        log.info("SlaService.verificarAtrasos concluído lojas={} OS_atualizadas={}", lojaIdsComAtraso.size(), totalAtualizadas);
    }

    /**
     * Busca OS atrasadas da loja atual (tenant) para API.
     * <p>
     * Critério: {@code previsaoEntrega < now() AND status NOT IN terminais AND alertaAtrasoDisparado=true/false}.
     * Retorna página paginada de {@code OrdemServicoResponse} via mapper do service chamador.
     *
     * @param lojaId   tenant obrigatório
     * @param pageable paginação
     * @return página de OS atrasadas
     */
    @Transactional(readOnly = true)
    public Page<OrdemServico> buscarAtrasadasPorLoja(UUID lojaId, Pageable pageable) {
        if (lojaId == null) {
            throw new IllegalArgumentException("lojaId é obrigatório para buscar OS atrasadas (multi-tenant)");
        }
        OffsetDateTime agora = OffsetDateTime.now(clock);
        return repository.findByLojaIdAndPrevisaoEntregaBeforeAndStatusNotIn(lojaId, agora, STATUS_TERMINAIS, pageable);
    }

    /**
     * Overload não paginado para uso interno/batch.
     */
    @Transactional(readOnly = true)
    public List<OrdemServico> buscarAtrasadasPorLoja(UUID lojaId) {
        if (lojaId == null) {
            throw new IllegalArgumentException("lojaId é obrigatório");
        }
        OffsetDateTime agora = OffsetDateTime.now(clock);
        return repository.findByLojaIdAndPrevisaoEntregaBeforeAndStatusNotIn(lojaId, agora, STATUS_TERMINAIS);
    }

    /**
     * Conta OS atrasadas da loja (para dashboard/badge).
     */
    @Transactional(readOnly = true)
    public long contarAtrasadasPorLoja(UUID lojaId) {
        if (lojaId == null) {
            throw new IllegalArgumentException("lojaId é obrigatório");
        }
        OffsetDateTime agora = OffsetDateTime.now(clock);
        return repository.findByLojaIdAndPrevisaoEntregaBeforeAndStatusNotIn(lojaId, agora, STATUS_TERMINAIS).size();
    }
}