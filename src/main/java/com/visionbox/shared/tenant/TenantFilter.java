package com.visionbox.shared.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * TenantFilter — primeira barreira multi-tenant (ADR-001).
 * <p>
 * Ordem: registrado em SecurityConfig após BearerTokenAuthenticationFilter.
 * Lê loja_id de:
 * 1) Claim JWT "loja_id" / "lojaId" / "tenant_id" — fonte primária para usuários autenticados
 * 2) Header X-Loja-Id (ou X-Tenant-Id) — compatibilidade para fluxos sem JWT de loja
 * 3) 403 quando header e claim JWT divergem
 * <p>
 * Popula TenantContext ThreadLocal + MDC "loja_id" para logs JSON.
 * SEMPRE limpa no finally — evita vazamento entre requisições no pool Tomcat.
 * <p>
 * RLS segunda barreira no PG garante que mesmo sem filtro, dados não vazam.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class TenantFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TenantFilter.class);

    public static final String HEADER_LOJA_ID = "X-Loja-Id";
    public static final String HEADER_TENANT_ID = "X-Tenant-Id";
    public static final String MDC_LOJA_ID = "loja_id";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        // endpoints públicos sem tenant — não bloqueia, apenas não seta
        if (isPublicPath(path)) {
            try {
                filterChain.doFilter(request, response);
            } finally {
                TenantContext.clear();
                MDC.remove(MDC_LOJA_ID);
            }
            return;
        }

        TenantResolution resolution = resolveTenantId(request);
        if (resolution.status() == TenantResolutionStatus.INVALID_HEADER) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "X-Loja-Id inválido");
            return;
        }
        if (resolution.status() == TenantResolutionStatus.TENANT_MISMATCH) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Tenant divergente do token");
            return;
        }
        UUID lojaId = resolution.lojaId();
        if (lojaId != null) {
            TenantContext.setCurrentLojaId(lojaId);
            MDC.put(MDC_LOJA_ID, lojaId.toString());
            log.debug("Tenant resolvido loja_id={} path={}", lojaId, path);
        } else {
            log.debug("Nenhum tenant resolvido para path={} — RLS ainda protege no DB", path);
        }

        try {
            // expõe loja_id resolvido em header de resposta para debug (dev only)
            if (lojaId != null) {
                response.setHeader(HEADER_LOJA_ID, lojaId.toString());
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            MDC.remove(MDC_LOJA_ID);
        }
    }

    private boolean isPublicPath(String path) {
        return path.startsWith("/actuator/")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/api/auth/")
                || path.startsWith("/api/v1/auth/")
                || path.equals("/error");
    }

    TenantResolution resolveTenantId(HttpServletRequest request) {
        UUID headerLojaId = null;
        String header = request.getHeader(HEADER_LOJA_ID);
        if (!StringUtils.hasText(header)) {
            header = request.getHeader(HEADER_TENANT_ID);
        }
        if (StringUtils.hasText(header)) {
            try {
                headerLojaId = UUID.fromString(header.trim());
            } catch (IllegalArgumentException e) {
                log.warn("Header {} com UUID inválido", HEADER_LOJA_ID);
                return TenantResolution.invalidHeader();
            }
        }

        UUID jwtLojaId = null;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            jwtLojaId = parseJwtTenant(jwtAuth.getToken());
        } else if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            jwtLojaId = parseJwtTenant(jwt);
        }

        if (jwtLojaId != null && headerLojaId != null && !jwtLojaId.equals(headerLojaId)) {
            log.warn("Tenant divergente entre JWT e header path={}", request.getRequestURI());
            return TenantResolution.mismatch();
        }

        if (jwtLojaId != null) {
            return TenantResolution.resolved(jwtLojaId);
        }
        return TenantResolution.resolved(headerLojaId);
    }

    private UUID parseJwtTenant(Jwt jwt) {
        String claim = firstClaim(jwt, "loja_id", "lojaId", "tenant_id", "tenantId");
        if (StringUtils.hasText(claim)) {
            try {
                return UUID.fromString(claim.trim());
            } catch (IllegalArgumentException e) {
                log.warn("JWT claim loja_id com UUID inválido");
            }
        }
        return null;
    }

    private String firstClaim(Jwt jwt, String... keys) {
        for (String k : keys) {
            Object v = jwt.getClaims().get(k);
            if (v != null) {
                return v.toString();
            }
        }
        return null;
    }

    enum TenantResolutionStatus {
        RESOLVED,
        INVALID_HEADER,
        TENANT_MISMATCH
    }

    record TenantResolution(UUID lojaId, TenantResolutionStatus status) {
        static TenantResolution resolved(UUID lojaId) {
            return new TenantResolution(lojaId, TenantResolutionStatus.RESOLVED);
        }

        static TenantResolution invalidHeader() {
            return new TenantResolution(null, TenantResolutionStatus.INVALID_HEADER);
        }

        static TenantResolution mismatch() {
            return new TenantResolution(null, TenantResolutionStatus.TENANT_MISMATCH);
        }
    }
}
