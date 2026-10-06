package com.visionbox.modules.crm.notificacao;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.shared.idempotency.OutboxMessage;
import com.visionbox.shared.outbox.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppOutboxPublisher {

    private final OutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final WhatsAppProvider provider;
    private final WhatsAppProperties properties;
    private final Clock clock;

    @Scheduled(fixedDelayString = "${visionbox.crm.whatsapp.poll-interval-ms:5000}")
    @Transactional
    public void publishPending() {
        if (!properties.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<OutboxMessage> messages = outboxRepository.findAll().stream()
                .filter(this::isWhatsAppMessage)
                .filter(OutboxMessage::isPending)
                .filter(m -> m.getProximaTentativa() == null || !m.getProximaTentativa().isAfter(now))
                .limit(50)
                .toList();

        for (OutboxMessage message : messages) {
            publishOne(message, now);
        }
    }

    void publishOne(OutboxMessage message, OffsetDateTime now) {
        try {
            WhatsAppOutboxPayload payload = objectMapper.readValue(message.getPayload(), WhatsAppOutboxPayload.class);
            WhatsAppSendResult result = provider.send(payload.toMessage());
            if (result.accepted()) {
                message.markSent();
                log.info("WhatsApp outbox enviado loja={} outbox={} provider={} providerMessageId={}",
                        message.getLojaId(), message.getId(), result.provider(), result.providerMessageId());
            } else {
                fail(message, result.error(), now);
            }
        } catch (JsonProcessingException e) {
            fail(message, "INVALID_WHATSAPP_PAYLOAD", now);
        } catch (RuntimeException e) {
            fail(message, safeError(e), now);
        }
    }

    private boolean isWhatsAppMessage(OutboxMessage message) {
        return WhatsAppNotificationService.AGGREGATE_TYPE.equals(message.getAggregateType());
    }

    private void fail(OutboxMessage message, String error, OffsetDateTime now) {
        if (message.getTentativas() >= properties.getMaxRetries()) {
            message.markFailed(error, null);
            log.warn("WhatsApp outbox esgotou tentativas loja={} outbox={} tentativas={} erro={}",
                    message.getLojaId(), message.getId(), message.getTentativas(), error);
            return;
        }
        long multiplier = 1L << Math.min(message.getTentativas(), 6);
        OffsetDateTime next = now.plus(properties.getRetryInitialDelay().multipliedBy(multiplier));
        message.markFailed(error, next);
        log.warn("WhatsApp outbox retry loja={} outbox={} tentativas={} proxima={} erro={}",
                message.getLojaId(), message.getId(), message.getTentativas(), next, error);
    }

    private String safeError(RuntimeException e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            return e.getClass().getSimpleName();
        }
        return message.length() > 120 ? message.substring(0, 120) : message;
    }
}
