package com.visionbox.modules.crm.notificacao;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.shared.idempotency.OutboxMessage;
import com.visionbox.shared.outbox.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppNotificationService {

    public static final String AGGREGATE_TYPE = "CRM_WHATSAPP";
    public static final String EVENT_OS_STATUS = "WHATSAPP_ORDEM_SERVICO_STATUS";

    private final OutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public OutboxMessage enqueueOrdemServicoStatus(UUID lojaId,
                                                   OrdemServico ordemServico,
                                                   Cliente cliente,
                                                   String idempotencyKey) {
        validateTenant(lojaId);
        if (ordemServico == null || ordemServico.getId() == null) {
            throw new IllegalArgumentException("ordemServico persistida é obrigatória");
        }
        if (cliente == null) {
            throw new IllegalArgumentException("cliente é obrigatório para notificação WhatsApp");
        }
        if (!canSendWhatsApp(cliente)) {
            throw new IllegalStateException("cliente sem consentimento/canal WhatsApp para notificação");
        }

        String key = StringUtils.hasText(idempotencyKey) ? idempotencyKey : buildIdempotencyKey(ordemServico);
        WhatsAppOutboxPayload payload = WhatsAppOutboxPayload.builder()
                .lojaId(lojaId)
                .clienteId(cliente.getId())
                .aggregateId(ordemServico.getId())
                .idempotencyKey(key)
                .type(WhatsAppNotificationType.ORDEM_SERVICO_STATUS)
                .to(cliente.getWhatsapp())
                .text(buildStatusMessage(ordemServico))
                .build();

        try {
            OutboxMessage message = OutboxMessage.builder()
                    .lojaId(lojaId)
                    .aggregateType(AGGREGATE_TYPE)
                    .aggregateId(ordemServico.getId().toString())
                    .eventType(EVENT_OS_STATUS)
                    .payload(objectMapper.writeValueAsString(payload))
                    .headers(objectMapper.writeValueAsString(Map.of("idempotencyKey", key)))
                    .status(OutboxMessage.Status.PENDING)
                    .build();
            OutboxMessage saved = outboxRepository.save(message);
            log.info("WhatsApp OS enfileirado loja={} os={} status={} outbox={}",
                    lojaId, ordemServico.getId(), ordemServico.getStatus(), saved.getId());
            return saved;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar payload WhatsApp", e);
        }
    }

    public boolean canSendWhatsApp(Cliente cliente) {
        if (cliente == null || !cliente.isConsentimentoRecall()) {
            return false;
        }
        String canal = cliente.getCanalPreferido();
        boolean canalPermite = canal == null || canal.isBlank() || "WHATSAPP".equalsIgnoreCase(canal);
        return canalPermite && StringUtils.hasText(cliente.getWhatsapp());
    }

    private void validateTenant(UUID lojaId) {
        if (lojaId == null) {
            throw new IllegalArgumentException("lojaId é obrigatório para notificação WhatsApp");
        }
    }

    private String buildIdempotencyKey(OrdemServico ordemServico) {
        return "os-status:" + ordemServico.getId() + ":" + ordemServico.getStatus();
    }

    private String buildStatusMessage(OrdemServico ordemServico) {
        return "Sua OS " + ordemServico.getNumero() + " está em " + ordemServico.getStatus() + ".";
    }
}
