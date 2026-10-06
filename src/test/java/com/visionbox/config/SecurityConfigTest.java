package com.visionbox.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigTest {

    @Test
    @DisplayName("perfil do JWT vira ROLE para RBAC por rota")
    void perfilClaimViraRoleAuthority() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("usuario")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .claim("perfil", "financeiro")
                .build();

        var authorities = new SecurityConfig.PerfilAuthoritiesConverter().convert(jwt);

        assertThat(authorities).extracting("authority").containsExactly("ROLE_FINANCEIRO");
    }
}
