package com.visionbox.modules.crm.notificacao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.shared.idempotency.OutboxMessage;
import com.visionbox.shared.outbox.OutboxRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WhatsAppOutboxPublisherTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-09-05T12:00:00Z"), ZoneOffset.UTC);
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void deveMarcarOutboxComoEnviadoQuandoProviderAceita() throws Exception {
        OutboxRepository repository = mock(OutboxRepository.class);
        WhatsAppProvider provider = mock(WhatsAppProvider.class);
        WhatsAppProperties properties = new WhatsAppProperties();
        OutboxMessage message = pendingMessage();

        when(repository.findAll()).thenReturn(List.of(message));
        when(provider.send(org.mockito.ArgumentMatchers.any()))
                .thenReturn(WhatsAppSendResult.accepted("MOCK", "mock-1"));

        WhatsAppOutboxPublisher publisher = new WhatsAppOutboxPublisher(repository, objectMapper, provider, properties, clock);
        publisher.publishPending();

        assertThat(message.getStatus()).isEqualTo(OutboxMessage.Status.SENT);
        assertThat(message.getEnviadoEm()).isNotNull();
        assertThat(message.getErroUltimo()).isNull();
    }

    @Test
    void deveAgendarRetryComBackoffQuandoProviderFalha() throws Exception {
        OutboxRepository repository = mock(OutboxRepository.class);
        WhatsAppProvider provider = mock(WhatsAppProvider.class);
        WhatsAppProperties properties = new WhatsAppProperties();
        properties.setRetryInitialDelay(Duration.ofSeconds(10));
        OutboxMessage message = pendingMessage();

        when(repository.findAll()).thenReturn(List.of(message));
        when(provider.send(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new WhatsAppProviderException("timeout"));

        WhatsAppOutboxPublisher publisher = new WhatsAppOutboxPublisher(repository, objectMapper, provider, properties, clock);
        publisher.publishPending();

        assertThat(message.getStatus()).isEqualTo(OutboxMessage.Status.FAILED);
        assertThat(message.getTentativas()).isEqualTo(1);
        assertThat(message.getProximaTentativa()).isEqualTo(OffsetDateTime.now(clock).plusSeconds(10));
        assertThat(message.getErroUltimo()).isEqualTo("timeout");
    }

    private OutboxMessage pendingMessage() throws Exception {
        UUID lojaId = UUID.randomUUID();
        UUID osId = UUID.randomUUID();
        WhatsAppOutboxPayload payload = WhatsAppOutboxPayload.builder()
                .lojaId(lojaId)
                .clienteId(UUID.randomUUID())
                .aggregateId(osId)
                .idempotencyKey("idem-1")
                .type(WhatsAppNotificationType.ORDEM_SERVICO_STATUS)
                .to("+55 11 99999-1234")
                .text("Sua OS está pronta.")
                .build();

        return OutboxMessage.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .aggregateType(WhatsAppNotificationService.AGGREGATE_TYPE)
                .aggregateId(osId.toString())
                .eventType(WhatsAppNotificationService.EVENT_OS_STATUS)
                .payload(objectMapper.writeValueAsString(payload))
                .status(OutboxMessage.Status.PENDING)
                .tentativas(0)
                .build();
    }
}
