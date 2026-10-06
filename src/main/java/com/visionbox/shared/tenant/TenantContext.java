package com.visionbox.shared.tenant;

import java.util.Optional;
import java.util.UUID;

/**
 * TenantContext — ThreadLocal para isolamento multi-tenant (ADR-001).
 * <p>
 * Estratégia: shared database / shared schema com coluna loja_id.
 * Segunda barreira: RLS FORCE no Postgres. Primeira barreira: @TenantId + TenantFilter.
 * <p>
 * Uso:
 * - TenantFilter popula no início da requisição (header X-Loja-Id ou claim JWT loja_id)
 * - CurrentTenantIdentifierResolver lê daqui para Hibernate
 * - Services/repositories NUNCA confiam em parâmetro solto; sempre via TenantContext.require()
 * <p>
 * ThreadLocal Inheritable para propagar em @Async / virtual threads quando necessário.
 * Sempre limpar no finally do filtro para evitar vazamento entre requisições (pool).
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT_TENANT = new InheritableThreadLocal<>();

    private TenantContext() {
    }

    public static void setCurrentTenant(UUID lojaId) {
        if (lojaId == null) {
            CURRENT_TENANT.remove();
        } else {
            CURRENT_TENANT.set(lojaId);
        }
    }

    /** Alias compatível com spec S0-01: setCurrentLojaId */
    public static void setCurrentLojaId(UUID lojaId) {
        setCurrentTenant(lojaId);
    }

    public static Optional<UUID> getCurrentTenant() {
        return Optional.ofNullable(CURRENT_TENANT.get());
    }

    public static Optional<UUID> getCurrentLojaId() {
        return getCurrentTenant();
    }

    /**
     * Retorna lojaId ou lança IllegalStateException (400/500 mapeado no handler).
     * Use em services antes de qualquer query.
     */
    public static UUID requireCurrentTenant() {
        return getCurrentTenant().orElseThrow(
                () -> new IllegalStateException("Tenant (loja_id) não definido no contexto. Header X-Loja-Id ausente ou JWT sem claim loja_id.")
        );
    }

    public static UUID requireCurrentLojaId() {
        return requireCurrentTenant();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }

    /**
     * Helper para jobs / testes — executa bloco com tenant temporário.
     */
    public static void withTenant(UUID lojaId, Runnable task) {
        UUID anterior = CURRENT_TENANT.get();
        try {
            setCurrentTenant(lojaId);
            task.run();
        } finally {
            if (anterior == null) {
                clear();
            } else {
                setCurrentTenant(anterior);
            }
        }
    }

    // ===== Compat aliases para código legado (PedidoVendaController, CurrentTenantIdentifierResolverImpl) =====
    public static UUID getLojaId() {
        return CURRENT_TENANT.get();
    }

    public static UUID requireLojaId() {
        return requireCurrentTenant();
    }

    public static UUID requireCurrentLojaIdCompat() {
        return requireCurrentTenant();
    }
}
