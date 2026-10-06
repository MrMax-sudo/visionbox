package com.visionbox.shared.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

/**
 * Resolvedor de tenant para Hibernate 6 multi-tenancy.
 * Implementa CurrentTenantIdentifierResolver&lt;String&gt; para trabalhar com
 * hibernate.multiTenancy = SCHEMA | DISCRIMINATOR — aqui usamos discriminator coluna
 * mas mantemos resolver para futuro schema-per-tenant (Fase 4) via SET search_path.
 *
 * ADR-001: shared database, shared schema com loja_id + @TenantId.
 * Este resolver permite hibernate abrir Session com tenant correto quando
 * spring.jpa.properties.hibernate.multi_tenant_connection_provider for habilitado.
 * Mesmo sem multiTenancy ativado, manter como bean facilita Inversão e testes.
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<String> {

    public static final String DEFAULT_TENANT = "public";

    @Override
    public String resolveCurrentTenantIdentifier() {
        return TenantContext.getCurrentLojaId()
                .map(java.util.UUID::toString)
                .orElse(DEFAULT_TENANT);
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        // true = Hibernate valida se Session atual pertence ao tenant do contexto
        return true;
    }

    @Override
    public boolean isRoot(String tenantId) {
        return DEFAULT_TENANT.equals(tenantId);
    }
}
