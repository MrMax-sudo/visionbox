package com.visionbox.modules.seguranca.desconto.controller;

import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoRequest;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoResponse;
import com.visionbox.modules.seguranca.desconto.service.AutorizacaoDescontoService;
import com.visionbox.modules.seguranca.desconto.service.RateLimitExcedidoException;
import com.visionbox.shared.error.ProblemDetailHandler;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AutorizacaoDescontoControllerTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID SOLICITANTE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private AutorizacaoDescontoService service;
    private AutorizacaoDescontoController controller;
    private HttpServletRequest httpRequest;

    @BeforeEach
    void setUp() {
        service = mock(AutorizacaoDescontoService.class);
        controller = new AutorizacaoDescontoController(service);
        httpRequest = mock(HttpServletRequest.class);
        when(httpRequest.getRemoteAddr()).thenReturn("10.0.0.1");
        TenantContext.setCurrentTenant(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private JwtAuthenticationToken autenticado() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(SOLICITANTE_ID.toString())
                .claim("loja_id", LOJA_ID.toString())
                .claim("perfil", "VENDEDOR")
                .build();
        return new JwtAuthenticationToken(jwt, List.of());
    }

    @Test
    @DisplayName("Endpoint devolve 200 com o resultado do service")
    void autorizaComSucesso() {
        AutorizacaoDescontoResponse esperada = AutorizacaoDescontoResponse.autorizado(
                new BigDecimal("20"), usuarioGerente());
        when(service.autorizar(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(LOJA_ID),
                org.mockito.ArgumentMatchers.eq(SOLICITANTE_ID),
                org.mockito.ArgumentMatchers.eq("10.0.0.1"),
                org.mockito.ArgumentMatchers.any())).thenReturn(esperada);

        var response = controller.autorizar(request(), autenticado(), httpRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().autorizado()).isTrue();
        assertThat(response.getBody().autorizadoPorNome()).isEqualTo("Maria Gerente");
    }

    @Test
    @DisplayName("Rate-limit excedido vira exceção 429 no controller (fora da transação)")
    void rateLimitVira429() {
        when(service.autorizar(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(LOJA_ID),
                org.mockito.ArgumentMatchers.eq(SOLICITANTE_ID),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()))
                .thenReturn(AutorizacaoDescontoResponse.bloqueadoPorRateLimit(new BigDecimal("20")));

        assertThatThrownBy(() -> controller.autorizar(request(), autenticado(), httpRequest))
                .isInstanceOf(RateLimitExcedidoException.class);
    }

    @Test
    @DisplayName("RateLimitExcedidoException mapeia para 429 RFC 7807 (genérico, sem PIN)")
    void handlerConverteRateLimitEm429() {
        ProblemDetailHandler handler = new ProblemDetailHandler();
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/v1/autorizacoes-desconto");

        ProblemDetail pd = handler.handleRateLimit(new RateLimitExcedidoException(), req);

        assertThat(pd.getStatus()).isEqualTo(429);
        assertThat(pd.getDetail()).isNotBlank();
        assertThat(pd.getDetail()).doesNotContain("1234", "admin", "senha");
    }

    private AutorizacaoDescontoRequest request() {
        return AutorizacaoDescontoRequest.builder()
                .descontoPercentual(new BigDecimal("20"))
                .senha("qualquer")
                .build();
    }

    private com.visionbox.modules.usuario.domain.Usuario usuarioGerente() {
        com.visionbox.modules.usuario.domain.Usuario gerente =
                com.visionbox.modules.usuario.domain.Usuario.builder()
                        .lojaId(LOJA_ID)
                        .nome("Maria Gerente")
                        .email("maria@visionbox.com.br")
                        .senhaHash("hash")
                        .perfil(com.visionbox.modules.usuario.domain.Perfil.GERENTE)
                        .build();
        gerente.setId(UUID.randomUUID());
        gerente.setAtivo(true);
        return gerente;
    }
}