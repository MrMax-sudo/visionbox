package com.visionbox.modules.crm.notificacao;

import lombok.Builder;

@Builder
public record WhatsAppSendResult(
        boolean accepted,
        String provider,
        String providerMessageId,
        String status,
        String error
) {

    public static WhatsAppSendResult accepted(String provider, String providerMessageId) {
        return WhatsAppSendResult.builder()
                .accepted(true)
                .provider(provider)
                .providerMessageId(providerMessageId)
                .status("ACCEPTED")
                .build();
    }

    public static WhatsAppSendResult rejected(String provider, String error) {
        return WhatsAppSendResult.builder()
                .accepted(false)
                .provider(provider)
                .status("REJECTED")
                .error(error)
                .build();
    }
}
