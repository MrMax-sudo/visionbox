package com.visionbox.shared.security;

import com.visionbox.modules.usuario.domain.Usuario;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expirationMinutes;
    private final long refreshDays;

    public JwtTokenProvider(
            @Value("${visionbox.jwt.secret:dev_jwt_secret_change_in_prod_32chars_min_dev_jwt_secret_change_in_prod}") String secret,
            @Value("${visionbox.jwt.expiration-minutes:15}") long expirationMinutes,
            @Value("${visionbox.jwt.refresh-days:7}") long refreshDays) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        // JJWT 0.12.x Keys.hmacShaKeyFor exige >=256 bits; secret dev já tem 64 chars =512 bits
        if (keyBytes.length < 32) {
            // pad to 32 bytes to avoid WeakKeyException in dev (não usar em prod)
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, Math.min(keyBytes.length, 32));
            for (int i = keyBytes.length; i < 32; i++) padded[i] = (byte) (i * 31);
            keyBytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMinutes = expirationMinutes;
        this.refreshDays = refreshDays;
    }

    public String generateAccessToken(Usuario usuario) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(expirationMinutes * 60);
        return Jwts.builder()
                .subject(usuario.getId().toString())
                .claim("email", usuario.getEmail())
                .claim("loja_id", usuario.getLojaId().toString())
                .claim("lojaId", usuario.getLojaId().toString())
                .claim("perfil", usuario.getPerfil().name())
                .claim("nome", usuario.getNome())
                .claim("type", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken(Usuario usuario) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(refreshDays * 24 * 60 * 60);
        String jti = UUID.randomUUID().toString();
        return Jwts.builder()
                .subject(usuario.getId().toString())
                .claim("email", usuario.getEmail())
                .claim("loja_id", usuario.getLojaId().toString())
                .claim("perfil", usuario.getPerfil().name())
                .claim("type", "refresh")
                .id(jti)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public RefreshTokenClaims parseRefreshToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Object type = claims.get("type");
        if (!"refresh".equals(type)) {
            throw new IllegalArgumentException("Token não é refresh");
        }

        String subject = claims.getSubject();
        Object lojaClaim = claims.get("loja_id");
        if (subject == null || subject.isBlank() || lojaClaim == null) {
            throw new IllegalArgumentException("Refresh token sem subject/loja_id");
        }

        return new RefreshTokenClaims(
                UUID.fromString(subject),
                UUID.fromString(lojaClaim.toString()),
                claims.getId());
    }

    public long getExpirationMinutes() {
        return expirationMinutes;
    }

    public long getRefreshDays() {
        return refreshDays;
    }

    public SecretKey getKey() {
        return key;
    }

    public record RefreshTokenClaims(UUID usuarioId, UUID lojaId, String jti) {}
}
