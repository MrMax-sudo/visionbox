package com.visionbox.modules.crm.notificacao;

import lombok.Builder;

import java.util.UUID;

@Builder
public record WhatsAppMessage(
        UUID lojaId,
        UUID clienteId,
        UUID aggregateId,
        String idempotencyKey,
        WhatsAppNotificationType type,
        String to,
        String text
) {
}
