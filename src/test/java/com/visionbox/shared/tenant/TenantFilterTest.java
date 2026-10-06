package com.visionbox.shared.tenant;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class TenantFilterTest {

    private static final UUID LOJA_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID LOJA_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private final TenantFilter filter = new TenantFilter();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    @DisplayName("JWT loja_id é fonte primária quando header confere")
    void jwtTenantComHeaderIgualSegue() throws Exception {
        authenticateWithTenant(LOJA_A);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/clientes");
        request.addHeader(TenantFilter.HEADER_LOJA_ID, LOJA_A.toString());
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        FilterChain chain = (req, res) -> {
            chainCalled.set(true);
            assertThat(TenantContext.requireCurrentLojaId()).isEqualTo(LOJA_A);
        };

        filter.doFilter(request, response, chain);

        assertThat(chainCalled).isTrue();
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeader(TenantFilter.HEADER_LOJA_ID)).isEqualTo(LOJA_A.toString());
        assertThat(TenantContext.getCurrentLojaId()).isEmpty();
    }

    @Test
    @DisplayName("Header divergente do JWT deve falhar 403 antes do controller")
    void headerDivergenteDoJwtFalha403() throws Exception {
        authenticateWithTenant(LOJA_A);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/clientes");
        request.addHeader(TenantFilter.HEADER_LOJA_ID, LOJA_B.toString());
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.doFilter(request, response, (req, res) -> chainCalled.set(true));

        assertThat(chainCalled).isFalse();
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(TenantContext.getCurrentLojaId()).isEmpty();
    }

    @Test
    @DisplayName("Header sem JWT ainda funciona para compatibilidade de fluxos autenticados legados")
    void headerSemJwtAindaResolveTenant() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/vendas");
        request.addHeader(TenantFilter.HEADER_LOJA_ID, LOJA_A.toString());
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.doFilter(request, response, (req, res) -> {
            chainCalled.set(true);
            assertThat(TenantContext.requireCurrentLojaId()).isEqualTo(LOJA_A);
        });

        assertThat(chainCalled).isTrue();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("Header malformado deve falhar 400")
    void headerInvalidoFalha400() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/clientes");
        request.addHeader(TenantFilter.HEADER_LOJA_ID, "loja-a");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.doFilter(request, response, (req, res) -> chainCalled.set(true));

        assertThat(chainCalled).isFalse();
        assertThat(response.getStatus()).isEqualTo(400);
    }

    private void authenticateWithTenant(UUID lojaId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(UUID.randomUUID().toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .claim("loja_id", lojaId.toString())
                .claim("perfil", "ADMIN")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
