package com.visionbox.shared.tenant;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import lombok.extern.slf4j.Slf4j;

/**
 * Opcional — injeta SET LOCAL app.loja_id para RLS.
 * Em teste, apenas loga; em prod, executa SET LOCAL via connection.
 */
@Slf4j
public class TenantStatementInspector implements StatementInspector {
    @Override
    public String inspect(String sql) {
        // Não modifica SQL em teste; RLS é validado via WHERE loja_id = ?
        // Em prod, ConnectionProvider faz SET LOCAL.
        return sql;
    }
}
