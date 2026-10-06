package com.visionbox.config;

import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * JwtConfig — centraliza SecretKey para JJWT 0.12.x + NimbusJwtDecoder.
 * Secret vem de visionbox.jwt.secret (env VISIONBOX_JWT_SECRET).
 * Access 15m / Refresh 7d via JwtTokenProvider.
 */
@Configuration
public class JwtConfig {

    @Bean
    public SecretKey jwtSecretKey(@Value("${visionbox.jwt.secret:dev_jwt_secret_change_in_prod_32chars_min_dev_jwt_secret_change_in_prod}") String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, Math.min(keyBytes.length, 32));
            for (int i = keyBytes.length; i < 32; i++) padded[i] = (byte) (i * 31);
            keyBytes = padded;
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
