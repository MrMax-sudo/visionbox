package com.visionbox.shared.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.util.ContentCachingResponseWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * IdempotencyFilter — R4 PDV outbox.
 * Intercepta POST/PUT/PATCH com header Idempotency-Key.
 * Se chave já existe e response já gravado, retorna 200 com body cacheado (replay).
 * Caso contrário, envolve response para capturar e persistir após chain.
 *
 * Nota S0: esqueleto funcional; persistência real via IdempotencyService no S0-02.
 * TTL 24h. Race protegido por UNIQUE(loja_id, chave) + @Version.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyFilter.class);
    public static final String HEADER_IDEMPOTENCY_KEY = "Idempotency-Key";

    private final IdempotencyRepository repository;
    private final ObjectMapper objectMapper;

    public IdempotencyFilter(IdempotencyRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String key = request.getHeader(HEADER_IDEMPOTENCY_KEY);
        boolean needsIdempotency = key != null
                && ("POST".equalsIgnoreCase(request.getMethod())
                || "PUT".equalsIgnoreCase(request.getMethod())
                || "PATCH".equalsIgnoreCase(request.getMethod()));

        if (!needsIdempotency) {
            filterChain.doFilter(request, response);
            return;
        }

        // valida formato UUID (recomendado, não obrigatório)
        try {
            UUID.fromString(key);
        } catch (IllegalArgumentException e) {
            log.warn("Idempotency-Key inválida (não UUID): {}", key);
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Idempotency-Key deve ser UUID v4");
            return;
        }

        Optional<UUID> lojaIdOpt = TenantContext.getCurrentLojaId();
        if (lojaIdOpt.isEmpty()) {
            // sem tenant ainda — deixa passar, será bloqueado depois; não quebra offline
            filterChain.doFilter(request, response);
            return;
        }
        UUID lojaId = lojaIdOpt.get();

        Optional<IdempotencyKey> existente = repository.findByLojaIdAndChave(lojaId, key);
        if (existente.isPresent()) {
            IdempotencyKey rec = existente.get();
            if (rec.isExpirado()) {
                repository.delete(rec);
            } else if (rec.isProcessado()) {
                log.info("Idempotency replay loja={} key={} status={}", lojaId, key, rec.getStatusCode());
                response.setStatus(rec.getStatusCode());
                if (rec.getResponseContentType() != null) {
                    response.setContentType(rec.getResponseContentType());
                }
                response.setHeader(HEADER_IDEMPOTENCY_KEY, key);
                if (rec.getResponseBody() != null) {
                    response.getWriter().write(rec.getResponseBody());
                }
                return;
            } else {
                // em processamento concorrente — 409
                response.sendError(HttpStatus.CONFLICT.value(), "Requisição com mesma Idempotency-Key em processamento");
                return;
            }
        }

        // cria registro pendente
        IdempotencyKey pending = IdempotencyKey.builder()
                .lojaId(lojaId)
                .chave(key)
                .metodo(request.getMethod())
                .path(request.getRequestURI())
                .expiraEm(OffsetDateTime.now().plusHours(24))
                .build();
        // tenta salvar; se race, unique violation será tratada como 409 no handler
        try {
            repository.save(pending);
        } catch (Exception ex) {
            log.warn("Race idempotency save loja={} key={}: {}", lojaId, key, ex.getMessage());
            response.sendError(HttpStatus.CONFLICT.value(), "Conflito de idempotência");
            return;
        }

        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        try {
            filterChain.doFilter(request, wrappedResponse);
        } finally {
            // captura resposta
            int status = wrappedResponse.getStatus();
            byte[] bytes = wrappedResponse.getContentAsByteArray();
            String body = bytes.length > 0 ? new String(bytes, StandardCharsets.UTF_8) : "";
            String ct = wrappedResponse.getContentType();

            pending.setStatusCode(status);
            pending.setResponseBody(body.length() > 100_000 ? body.substring(0, 100_000) : body);
            pending.setResponseContentType(ct);
            repository.save(pending);

            // copia body para response real
            wrappedResponse.copyBodyToResponse();
        }
    }
}
