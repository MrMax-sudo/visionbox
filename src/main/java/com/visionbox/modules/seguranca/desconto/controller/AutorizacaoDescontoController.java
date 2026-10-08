package com.visionbox.modules.seguranca.desconto.controller;

import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoRequest;
import com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoResponse;
import com.visionbox.modules.seguranca.desconto.service.AutorizacaoDescontoService;
import com.visionbox.modules.seguranca.desconto.service.RateLimitExcedidoException;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * P7 — validação de alçada de desconto no BACKEND.
 * <p>
 * {@code POST /api/v1/autorizacoes-desconto} — autenticado (qualquer perfil da
 * loja pode SOLICITAR; a autorização depende do PIN gerencial). O tenant vem do
 * JWT/header via {@link TenantContext}, nunca do body (não é confiável).
 * <p>
 * Rate-limit em memória: após 5 falhas (15 min) por loja+usuário o controller
 * lança {@link RateLimitExcedidoException} → HTTP 429 via ProblemDetailHandler.
 * PIN nunca é logado; resposta de PIN inválido é genérica.
 */
@RestController
@RequestMapping("/api/v1/autorizacoes-desconto")
@RequiredArgsConstructor
public class AutorizacaoDescontoController {

    private final AutorizacaoDescontoService autorizacaoDescontoService;

    @PostMapping
    public ResponseEntity<AutorizacaoDescontoResponse> autorizar(
            @Valid @RequestBody AutorizacaoDescontoRequest req,
            Authentication authentication,
            HttpServletRequest httpRequest) {

        UUID lojaId = TenantContext.requireCurrentLojaId();
        UUID solicitanteId = extrairUsuarioId(authentication);

        AutorizacaoDescontoResponse resposta = autorizacaoDescontoService.autorizar(
                req,
                lojaId,
                solicitanteId,
                httpRequest.getRemoteAddr(),
                httpRequest.getHeader(HttpHeaders.USER_AGENT));

        if (resposta.rateLimitExcedido()) {
            // lançado FORA da transação do service (auditoria da tentativa já persistida)
            throw new RateLimitExcedidoException();
        }

        return ResponseEntity.ok(resposta);
    }

    private UUID extrairUsuarioId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            try {
                return UUID.fromString(jwt.getSubject());
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        return null;
    }
}