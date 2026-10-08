package com.visionbox.config;

import io.micrometer.common.KeyValue;
import io.micrometer.common.KeyValues;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.observation.DefaultServerRequestObservationConvention;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.stereotype.Component;

/**
 * Adiciona a tag de baixa cardinalidade {@code loja} a todas as métricas HTTP
 * ({@code http_server_requests_seconds*}) — dashboard "Multi-loja" (docs/METRICS.md).
 * <p>
 * Fonte: header {@code X-Loja-Id} (ou {@code X-Tenant-Id}) da requisição; ausente → {@code none}.
 * O filtro de observação do Boot 3.4 pega este bean automaticamente
 * ({@code WebMvcObservationAutoConfiguration.webMvcObservationFilter} usa
 * {@code ObjectProvider<ServerRequestObservationConvention>}).
 */
@Component
public class LojaObservationConvention extends DefaultServerRequestObservationConvention {

    @Override
    public KeyValues getLowCardinalityKeyValues(ServerRequestObservationContext context) {
        KeyValues base = super.getLowCardinalityKeyValues(context);
        if (context == null) {
            return base;
        }
        HttpServletRequest request = context.getCarrier();
        String loja = "none";
        if (request != null) {
            String header = request.getHeader("X-Loja-Id");
            if (header == null || header.isBlank()) {
                header = request.getHeader("X-Tenant-Id");
            }
            if (header != null && !header.isBlank()) {
                loja = header.trim();
            }
        }
        return base.and(KeyValue.of("loja", loja));
    }
}