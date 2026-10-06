package com.visionbox.shared.tenant;

import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Config para Hibernate multi-tenancy discriminator.
 * S0 não ativa multiTenancy no Hibernate (usa @TenantId), mas deixa bean pronto
 * para Fase 4 schema-per-tenant sem rewrite: basta ativar hibernate.multiTenancy=SCHEMA
 * e trocar connection provider.
 */
@Configuration
public class TenantJpaConfig {

    @Bean
    public HibernatePropertiesCustomizer tenantCustomizer(TenantIdentifierResolver resolver) {
        return props -> {
            // Comentado: manter discriminator column (ADR-001 shared) por padrão.
            // Descomentar quando migrar para SCHEMA:
            // props.put(AvailableSettings.MULTI_TENANT, "SCHEMA");
            // props.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);
            // RLS já é segunda barreira; não depende de Hibernate multi-tenancy.
        };
    }
}
