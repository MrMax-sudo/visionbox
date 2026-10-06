package com.visionbox.modules.crm.notificacao;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfigurableWhatsAppProvider implements WhatsAppProvider {

    private final WhatsAppProperties properties;
    private final Clock clock;
    private final AtomicInteger failures = new AtomicInteger();
    private volatile OffsetDateTime circuitOpenedAt;

    @Override
    public WhatsAppSendResult send(WhatsAppMessage message) {
        if (!properties.isEnabled()) {
            return WhatsAppSendResult.rejected(properties.getProvider().name(), "WHATSAPP_DISABLED");
        }
        if (properties.getProvider() == WhatsAppProviderType.MOCK) {
            return mockAccepted(message);
        }
        if (isCircuitOpen()) {
            log.warn("WhatsApp circuit aberto loja={} provider={} aggregate={}",
                    message.lojaId(), properties.getProvider(), message.aggregateId());
            return fallbackOrReject(message, "CIRCUIT_OPEN");
        }
        if (!StringUtils.hasText(properties.getBaseUrl())) {
            return fallbackOrReject(message, "PROVIDER_BASE_URL_NOT_CONFIGURED");
        }

        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(properties.getTimeout());
            requestFactory.setReadTimeout(properties.getTimeout());

            RestClient client = RestClient.builder()
                    .baseUrl(properties.getBaseUrl())
                    .requestFactory(requestFactory)
                    .build();

            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(providerPath())
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Idempotency-Key", message.idempotencyKey())
                    .body(providerPayload(message))
                    .retrieve()
                    .body(Map.class);

            failures.set(0);
            circuitOpenedAt = null;
            String providerMessageId = response != null && response.get("id") != null
                    ? response.get("id").toString()
                    : UUID.randomUUID().toString();
            log.info("WhatsApp enviado loja={} provider={} aggregate={} messageId={}",
                    message.lojaId(), properties.getProvider(), message.aggregateId(), providerMessageId);
            return WhatsAppSendResult.accepted(properties.getProvider().name(), providerMessageId);
        } catch (RestClientException e) {
            registerFailure();
            throw new WhatsAppProviderException("Falha ao enviar WhatsApp pelo provider " + properties.getProvider(), e);
        }
    }

    private WhatsAppSendResult fallbackOrReject(WhatsAppMessage message, String reason) {
        if (properties.isFallbackToMock()) {
            log.warn("WhatsApp fallback mock loja={} provider={} aggregate={} reason={}",
                    message.lojaId(), properties.getProvider(), message.aggregateId(), reason);
            return mockAccepted(message);
        }
        return WhatsAppSendResult.rejected(properties.getProvider().name(), reason);
    }

    private WhatsAppSendResult mockAccepted(WhatsAppMessage message) {
        String providerMessageId = "mock-" + UUID.randomUUID();
        log.info("WhatsApp mock accepted loja={} type={} aggregate={} messageId={} destino={}",
                message.lojaId(), message.type(), message.aggregateId(), providerMessageId, maskPhone(message.to()));
        return WhatsAppSendResult.accepted(WhatsAppProviderType.MOCK.name(), providerMessageId);
    }

    private String providerPath() {
        if (properties.getProvider() == WhatsAppProviderType.META) {
            return "/messages";
        }
        if (StringUtils.hasText(properties.getInstanceId())) {
            return "/instances/" + properties.getInstanceId() + "/token/send-text";
        }
        return "/send-text";
    }

    private Map<String, Object> providerPayload(WhatsAppMessage message) {
        return Map.of(
                "phone", normalizePhone(message.to()),
                "message", message.text(),
                "externalId", message.idempotencyKey()
        );
    }

    private boolean isCircuitOpen() {
        OffsetDateTime openedAt = circuitOpenedAt;
        if (openedAt == null) {
            return false;
        }
        return openedAt.plus(properties.getCircuitOpenDuration()).isAfter(OffsetDateTime.now(clock));
    }

    private void registerFailure() {
        int total = failures.incrementAndGet();
        if (total >= properties.getCircuitFailureThreshold() && circuitOpenedAt == null) {
            circuitOpenedAt = OffsetDateTime.now(clock);
            log.warn("WhatsApp circuit aberto provider={} failures={}", properties.getProvider(), total);
        }
    }

    private String normalizePhone(String phone) {
        if (phone == null) {
            return "";
        }
        return phone.replaceAll("\\D", "");
    }

    private String maskPhone(String phone) {
        String digits = normalizePhone(phone);
        if (digits.length() <= 4) {
            return "****";
        }
        return "***" + digits.substring(digits.length() - 4);
    }
}
