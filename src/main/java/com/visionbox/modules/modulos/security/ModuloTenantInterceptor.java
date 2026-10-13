package com.visionbox.modules.modulos.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.service.ModuloConfiguracaoService;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * ModuloTenantInterceptor — enforcement backend de módulo por loja (spec §4.4, R11).
 * <p>
 * Verifica apenas handlers anotados com {@link RequerModulo} (classe ou método). Lê a loja do
 * {@code TenantContext} (populada pelo {@code TenantFilter} a partir do JWT/header) e consulta
 * {@code modulo_configuracao_loja} via {@link ModuloConfiguracaoService#moduloAtivo}.
 * <p>
 * Registrado por {@link ModuloInterceptorConfig} (WebMvcConfigurer próprio) — o
 * {@code SecurityConfig} não foi alterado.
 * <p>
 * Payload de bloqueio (spec §4.4):
 * <pre>{"status":403,"codigo":"MODULO_NAO_CONTRATADO","modulo":"ETIQUETAS","mensagem":"..."}</pre>
 * Sem {@code TenantContext} a resposta é fail-closed com {@code codigo=TENANT_AUSENTE}
 * (não dá para validar contrato sem saber a loja).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ModuloTenantInterceptor implements HandlerInterceptor {

    static final String CODIGO_NAO_CONTRATADO = "MODULO_NAO_CONTRATADO";
    static final String CODIGO_TENANT_AUSENTE = "TENANT_AUSENTE";

    private final ModuloConfiguracaoService moduloService;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequerModulo requerModulo = resolver(handlerMethod);
        if (requerModulo == null) {
            return true;
        }

        ModuloSistema modulo = requerModulo.value();
        UUID lojaId = TenantContext.getCurrentTenant().orElse(null);
        if (lojaId == null) {
            log.warn("Módulo {} exigido sem TenantContext — bloqueio fail-closed. URI={}",
                    modulo.name(), request.getRequestURI());
            responder(response, CODIGO_TENANT_AUSENTE, modulo,
                    "Loja (tenant) não identificada na requisição — módulo não pôde ser validado.");
            return false;
        }

        if (moduloService.moduloAtivo(lojaId, modulo)) {
            return true;
        }

        log.info("Módulo {} não contratado para a loja {} — 403. URI={}",
                modulo.name(), lojaId, request.getRequestURI());
        responder(response, CODIGO_NAO_CONTRATADO, modulo,
                "O módulo de " + modulo.getNomeExibicao() + " não está liberado no plano contratado para esta loja.");
        return false;
    }

    /** Descobre a anotação no método ou na classe do controller (inclui superclasses). */
    RequerModulo resolver(HandlerMethod handlerMethod) {
        RequerModulo noMetodo = handlerMethod.getMethodAnnotation(RequerModulo.class);
        if (noMetodo != null) {
            return noMetodo;
        }
        return AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), RequerModulo.class);
    }

    private void responder(HttpServletResponse response, String codigo, ModuloSistema modulo, String mensagem)
            throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", HttpServletResponse.SC_FORBIDDEN);
        payload.put("codigo", codigo);
        payload.put("modulo", modulo != null ? modulo.name() : null);
        payload.put("mensagem", mensagem);

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(payload));
    }
}
