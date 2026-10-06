package com.visionbox.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecurityValidatorTest {

    @Test
    @DisplayName("prod falha fechado quando usa secrets dev/default")
    void prodFalhaComSecretsDefault() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("spring.profiles.active", "prod")
                .withProperty("visionbox.jwt.secret", "dev_jwt_secret_change_in_prod_32chars_min_dev_jwt_secret_change")
                .withProperty("visionbox.crypto.kek-hex", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
                .withProperty("visionbox.crypto.hmac-pepper", "dev_hmac_pepper_change_in_prod");
        env.setActiveProfiles("prod");

        assertThatThrownBy(() -> new ProductionSecurityValidator(env).validateProductionSecrets())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("visionbox.jwt.secret");
    }

    @Test
    @DisplayName("prod aceita secrets explícitos e register público desligado")
    void prodAceitaSecretsExplicitos() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("visionbox.jwt.secret", "prod_jwt_secret_32_chars_minimo_para_hs256")
                .withProperty("visionbox.crypto.kek-hex", "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd")
                .withProperty("visionbox.crypto.hmac-pepper", "pepper-prod-secreto")
                .withProperty("visionbox.laboratorio.portal-token-secret", "lab_portal_secret_prod_separado_32_chars")
                .withProperty("visionbox.auth.public-register-enabled", "false");
        env.setActiveProfiles("prod");

        assertThatCode(() -> new ProductionSecurityValidator(env).validateProductionSecrets())
                .doesNotThrowAnyException();
    }
}
