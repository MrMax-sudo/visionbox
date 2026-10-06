package com.visionbox.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class ProductionSecurityValidator {

    private static final String DEV_JWT_SECRET = "dev_jwt_secret_change_in_prod_32chars_min_dev_jwt_secret_change";
    private static final String DEV_KEK_HEX = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    private static final String DEV_HMAC_PEPPER = "dev_hmac_pepper_change_in_prod";

    private final Environment environment;

    @PostConstruct
    void validateProductionSecrets() {
        if (!environment.matchesProfiles("prod")) {
            return;
        }

        requireSecret("visionbox.jwt.secret", DEV_JWT_SECRET);
        requireSecret("visionbox.crypto.kek-hex", DEV_KEK_HEX);
        requireSecret("visionbox.crypto.hmac-pepper", DEV_HMAC_PEPPER);
        requireSecret("visionbox.laboratorio.portal-token-secret", null);

        boolean publicRegister = environment.getProperty("visionbox.auth.public-register-enabled", Boolean.class, false);
        if (publicRegister) {
            throw new IllegalStateException("visionbox.auth.public-register-enabled deve ser false em prod");
        }

        Set<String> active = Set.of(environment.getActiveProfiles());
        if (active.contains("dev")) {
            throw new IllegalStateException("profile dev não pode estar ativo junto com prod");
        }
    }

    private void requireSecret(String key, String forbiddenDefault) {
        String value = environment.getProperty(key);
        if (!StringUtils.hasText(value) || (forbiddenDefault != null && forbiddenDefault.equals(value.trim()))) {
            throw new IllegalStateException(key + " deve ser definido por secret manager/env em prod");
        }
    }
}
