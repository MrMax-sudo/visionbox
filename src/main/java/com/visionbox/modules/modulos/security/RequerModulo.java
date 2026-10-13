package com.visionbox.modules.modulos.security;

import com.visionbox.modules.modulos.domain.ModuloSistema;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declara que o endpoint pertence a um módulo SaaS e só responde se a loja contratou (R11).
 * <p>
 * Aplicável na classe inteira do controller ou em métodos pontuais:
 * <pre>
 * &#64;RequerModulo(ModuloSistema.ETIQUETAS)
 * &#64;GetMapping("/etiquetas/imprimir")
 * </pre>
 * O {@code ModuloTenantInterceptor} (WebMvcConfigurer próprio — o SecurityConfig não muda)
 * responde 403 com payload {@code {"status":403,"codigo":"MODULO_NAO_CONTRATADO",...}}
 * quando a loja do {@code TenantContext} não tem o módulo ativo (spec §4.4).
 * <p>
 * Não anote endpoints públicos (rastreio, portal do lab): sem {@code TenantContext} o
 * interceptor responde 403 fail-closed.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequerModulo {

    /** Módulo exigido (catálogo spec §4.1). */
    ModuloSistema value();
}
