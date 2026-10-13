package com.visionbox.modules.modulos.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registra o {@link ModuloTenantInterceptor} sem tocar no {@code SecurityConfig} (regra do
 * orquestrador: SecurityConfig é arquivo compartilhado do orquestrador).
 * <p>
 * O filtro {@code TenantFilter} roda antes (cadeia de filtros do servlet), portanto o
 * {@code TenantContext} já está populado quando o interceptor é chamado. Escopo
 * {@code /api/**}: o gating é de API; rotas públicas (rastreio/lab) não são anotadas.
 * <p>
 * Não usar {@code @EnableWebMvc} aqui — {@code WebMvcConfigurer} compõe com a auto-config
 * do Boot, não a substitui.
 */
@Configuration
@RequiredArgsConstructor
public class ModuloInterceptorConfig implements WebMvcConfigurer {

    private final ModuloTenantInterceptor moduloTenantInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(moduloTenantInterceptor)
                .addPathPatterns("/api/**")
                .order(0);
    }
}
