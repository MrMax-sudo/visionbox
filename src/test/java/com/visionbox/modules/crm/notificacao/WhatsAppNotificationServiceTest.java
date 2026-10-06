package com.visionbox.modules.crm.notificacao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.shared.idempotency.OutboxMessage;
import com.visionbox.shared.outbox.OutboxRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WhatsAppNotificationServiceTest {

    private OutboxRepository outboxRepository;
    private ObjectMapper objectMapper;
    private WhatsAppNotificationService service;

    @BeforeEach
    void setUp() {
        outboxRepository = mock(OutboxRepository.class);
        objectMapper = new ObjectMapper().findAndRegisterModules();
        service = new WhatsAppNotificationService(outboxRepository, objectMapper);
    }

    @Test
    void deveEnfileirarMensagemComConsentimentoEIdempotencia() throws Exception {
        UUID lojaId = UUID.randomUUID();
        UUID osId = UUID.randomUUID();
        UUID clienteId = UUID.randomUUID();
        OrdemServico os = OrdemServico.builder()
                .id(osId)
                .lojaId(lojaId)
                .numero("OS-2026-00001")
                .status(StatusOS.PRONTO_PARA_RETIRADA)
                .build();
        Cliente cliente = Cliente.builder()
                .id(clienteId)
                .lojaId(lojaId)
                .nome("Cliente Teste")
                .whatsapp("+55 11 99999-1234")
                .canalPreferido("WHATSAPP")
                .consentimentoRecall(true)
                .build();

        when(outboxRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        OutboxMessage saved = service.enqueueOrdemServicoStatus(lojaId, os, cliente, "idem-123");

        ArgumentCaptor<OutboxMessage> captor = ArgumentCaptor.forClass(OutboxMessage.class);
        org.mockito.Mockito.verify(outboxRepository).save(captor.capture());
        OutboxMessage message = captor.getValue();
        WhatsAppOutboxPayload payload = objectMapper.readValue(message.getPayload(), WhatsAppOutboxPayload.class);

        assertThat(saved).isSameAs(message);
        assertThat(message.getLojaId()).isEqualTo(lojaId);
        assertThat(message.getAggregateType()).isEqualTo(WhatsAppNotificationService.AGGREGATE_TYPE);
        assertThat(message.getEventType()).isEqualTo(WhatsAppNotificationService.EVENT_OS_STATUS);
        assertThat(message.getStatus()).isEqualTo(OutboxMessage.Status.PENDING);
        assertThat(payload.idempotencyKey()).isEqualTo("idem-123");
        assertThat(payload.to()).isEqualTo("+55 11 99999-1234");
        assertThat(payload.text()).contains("OS-2026-00001", "PRONTO_PARA_RETIRADA");
        assertThat(message.getPayload()).doesNotContain("Cliente Teste");
    }

    @Test
    void deveBloquearClienteSemConsentimento() {
        OrdemServico os = OrdemServico.builder()
                .id(UUID.randomUUID())
                .numero("OS-2026-00001")
                .status(StatusOS.ORCAMENTO)
                .build();
        Cliente cliente = Cliente.builder()
                .id(UUID.randomUUID())
                .whatsapp("+55 11 99999-1234")
                .canalPreferido("WHATSAPP")
                .consentimentoRecall(false)
                .build();

        assertThatThrownBy(() -> service.enqueueOrdemServicoStatus(UUID.randomUUID(), os, cliente, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("consentimento");
    }

    @Test
    void deveRespeitarOptOutDeCanal() {
        Cliente cliente = Cliente.builder()
                .whatsapp("+55 11 99999-1234")
                .canalPreferido("EMAIL")
                .consentimentoRecall(true)
                .build();

        assertThat(service.canSendWhatsApp(cliente)).isFalse();
    }
}
