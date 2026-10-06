package com.visionbox.modules.crm.notificacao;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "visionbox.crm.whatsapp")
public class WhatsAppProperties {

    private boolean enabled = true;
    private WhatsAppProviderType provider = WhatsAppProviderType.MOCK;
    private Duration timeout = Duration.ofSeconds(5);
    private Duration retryInitialDelay = Duration.ofSeconds(30);
    private int maxRetries = 5;
    private int circuitFailureThreshold = 3;
    private Duration circuitOpenDuration = Duration.ofMinutes(1);
    private String baseUrl;
    private String instanceId;
    private boolean fallbackToMock = true;
}
