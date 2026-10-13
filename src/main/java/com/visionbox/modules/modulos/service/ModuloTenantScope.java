package com.visionbox.modules.modulos.service;

import com.visionbox.shared.tenant.TenantContext;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * ModuloTenantScope — troca o tenant do ThreadLocal durante uma chamada cross-tenant.
 * <p>
 * O Painel do Desenvolvedor opera na loja indicada no path ({@code /dev/lojas/{lojaId}/...}),
 * mas o {@code TenantFilter} só conhece a loja do JWT/header. Sem esta troca, o
 * {@code TenantRlsAspect} grava a GUC {@code app.loja_id} da loja do operador no início da
 * transação e a RLS FORCE da V36 esconderia (leitura) ou rejeitaria (escrita) as linhas da
 * loja alvo — fail-closed correto, porém errado para o operador autorizado.
 * <p>
 * A troca acontece ANTES do proxy {@code @Transactional}: o aspecto lê o ThreadLocal na
 * entrada da transação. O valor anterior é restaurado no finally (nenhum vazamento entre
 * requisições no pool Tomcat).
 * <p>
 * Uso restrito a chamadas já autorizadas ({@code ModuloConfiguracaoService.autorizarAcessoLoja}).
 */
public final class ModuloTenantScope {

    private ModuloTenantScope() {
    }

    public static <T> T executar(UUID lojaAlvo, Supplier<T> acao) {
        UUID anterior = TenantContext.getLojaId();
        TenantContext.setCurrentTenant(lojaAlvo);
        try {
            return acao.get();
        } finally {
            if (anterior == null) {
                TenantContext.clear();
            } else {
                TenantContext.setCurrentTenant(anterior);
            }
        }
    }
}
