package com.visionbox.modules.ordemservico.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

/**
 * Token opaco (HMAC-SHA256, sem persistência) do rastreio PÚBLICO da OS (US17).
 *
 * <p>Mesmo padrão de {@code LabPortalTokenService}: token assinado carrega
 * {@code lojaId} + {@code ordemServicoId} + {@code exp}, evitando migration
 * (P1 bloqueia novas tabelas) e permitindo validação stateless no endpoint público.
 *
 * <p>Formato: {@code rpub1.<payload-base64url>.<assinatura-base64url>}.
 * Expiração → HTTP 410 (GONE); assinatura/estrutura inválida → HTTP 404 (não revela).
 */
@Service
public class RastreioTokenService {

    private static final String VERSION = "rpub1";
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String SCOPE = "RASTREIO_PUBLIC";
    private static final int DEFAULT_TTL_MINUTES = 60 * 24 * 30; // 30 dias

    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final byte[] secret;
    private final int ttlMinutos;

    public RastreioTokenService(
            ObjectMapper objectMapper,
            Clock clock,
            @Value("${visionbox.rastreio.token-secret:${visionbox.jwt.secret:dev_jwt_secret_change_in_prod_32chars_min_dev_jwt_secret_change_in_prod}}") String secret,
            @Value("${visionbox.rastreio.token-ttl-minutes:" + DEFAULT_TTL_MINUTES + "}") int ttlMinutos) {
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.ttlMinutos = ttlMinutos;
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("visionbox.rastreio.token-secret deve ter pelo menos 32 bytes");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** Gera o token de rastreio para a OS da loja. */
    public String gerar(UUID lojaId, UUID ordemServicoId) {
        OffsetDateTime expiraEm = OffsetDateTime.now(clock).plusMinutes(ttlMinutos);
        String payload = encodeJson(Map.of(
                "scope", SCOPE,
                "lojaId", lojaId.toString(),
                "ordemServicoId", ordemServicoId.toString(),
                "exp", expiraEm.toInstant().getEpochSecond()
        ));
        return VERSION + "." + payload + "." + assinar(payload);
    }

    /**
     * Valida estrutura/assinatura/expiração.
     * @throws ResponseStatusException 404 (inválido) ou 410 (expirado)
     */
    public Payload validar(String token) {
        String[] partes = token != null ? token.split("\\.", -1) : new String[0];
        if (partes.length != 3 || !VERSION.equals(partes[0])) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Link de rastreio inválido");
        }
        String assinaturaEsperada = assinar(partes[1]);
        if (!MessageDigest.isEqual(
                assinaturaEsperada.getBytes(StandardCharsets.UTF_8),
                partes[2].getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Link de rastreio inválido");
        }
        Map<String, Object> payload = decodeJson(partes[1]);
        if (!SCOPE.equals(payload.get("scope"))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Token de rastreio inválido");
        }
        long expEpoch = ((Number) payload.get("exp")).longValue();
        if (OffsetDateTime.now(clock).toInstant().getEpochSecond() >= expEpoch) {
            throw new ResponseStatusException(HttpStatus.GONE, "Token de rastreio expirado");
        }
        try {
            return new Payload(
                    UUID.fromString(String.valueOf(payload.get("lojaId"))),
                    UUID.fromString(String.valueOf(payload.get("ordemServicoId"))));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Token de rastreio inválido");
        }
    }

    private String encodeJson(Map<String, Object> map) {
        try {
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(map));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao serializar payload do rastreio", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decodeJson(String payload) {
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(payload);
            return objectMapper.readValue(bytes, Map.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Token de rastreio inválido");
        }
    }

    private String assinar(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            byte[] assinatura = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            validarTamanho(assinatura);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(assinatura);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao assinar token de rastreio", e);
        }
    }

    private void validarTamanho(byte[] assinatura) {
        if (assinatura == null || assinatura.length == 0) {
            throw new IllegalStateException("Assinatura vazia");
        }
        // constant-time compare é feito em validar(); aqui apenas garante não-vazio
        if (!MessageDigest.isEqual(assinatura, assinatura)) {
            throw new IllegalStateException("Assinatura inválida");
        }
    }

    /** Dados validados do token. */
    public record Payload(UUID lojaId, UUID ordemServicoId) {}
}