package com.visionbox.modules.crm.notificacao;

import lombok.Builder;

import java.util.UUID;

@Builder
public record WhatsAppOutboxPayload(
        UUID lojaId,
        UUID clienteId,
        UUID aggregateId,
        String idempotencyKey,
        WhatsAppNotificationType type,
        String to,
        String text
) {

    public WhatsAppMessage toMessage() {
        return WhatsAppMessage.builder()
                .lojaId(lojaId)
                .clienteId(clienteId)
                .aggregateId(aggregateId)
                .idempotencyKey(idempotencyKey)
                .type(type)
                .to(to)
                .text(text)
                .build();
    }
}
