package com.visionbox.shared.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentTenantIdentifierResolverImpl implements CurrentTenantIdentifierResolver<UUID> {

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        UUID lojaId = TenantContext.getLojaId();
        // Hibernate exige non-null; usar UUID zero se ausente para falhar em RLS
        return lojaId != null ? lojaId : UUID.fromString("00000000-0000-0000-0000-000000000000");
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}
