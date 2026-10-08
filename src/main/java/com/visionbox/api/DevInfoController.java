package com.visionbox.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Map;

/**
 * Painel Desenvolvedor (somente ADMIN/DESENVOLVEDOR — rota /api/v1/dev/**).
 * Retorna apenas informação sanitizada (sem segredos/CPF/grau, LGPD-safe).
 */
@RestController
@RequestMapping("/api/v1/dev")
public class DevInfoController {

    private final Environment environment;
    private final String version;

    public DevInfoController(Environment environment,
                             @Value("${spring.application.version:develop}") String version) {
        this.environment = environment;
        this.version = version;
    }

    @GetMapping("/info")
    public Map<String, Object> info() {
        String[] profiles = environment.getActiveProfiles();
        String fiscalProvider = "mock";
        if (Arrays.asList(profiles).contains("flowbox") || Arrays.asList(profiles).contains("prod")) {
            fiscalProvider = "flowbox";
        } else if (Arrays.asList(profiles).contains("sefaz-direto")) {
            fiscalProvider = "sefaz-direto";
        }
        return Map.of(
                "app", "VisionBox",
                "version", version,
                "profiles", String.join(",", profiles),
                "fiscalProvider", fiscalProvider,
                "outboxEnabled", environment.getProperty("visionbox.outbox.poll-interval-ms", "false"),
                "timezone", environment.getProperty("spring.jpa.properties.hibernate.jdbc.time_zone", "UTC")
        );
    }
}