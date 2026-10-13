package com.visionbox.modules.modulos.domain;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/**
 * PlanoSaaS — matriz de planos comerciais (spec §4.2).
 * <p>
 * START ⊂ PRO ⊂ ENTERPRISE (progressivo). {@link #PERSONALIZADO} não tem matriz:
 * é o modo manual em que a TECHBOXBR liga/desliga módulos avulso por avulso
 * e portanto NÃO é aplicável via API de plano (o Painel usa o toggle granular).
 */
public enum PlanoSaaS {

    /** Plano Start / PDV — básico. */
    START(Set.of(
            ModuloSistema.PDV_BALCAO,
            ModuloSistema.CENTRAL_VENDAS,
            ModuloSistema.CAIXA_TURNOS)),

    /** Plano Pro / Ótica Especializada — tudo do Start + núcleo ótico. */
    PRO(modulosStartEUtc()),

    /** Plano Enterprise / Redes & Alta Performance — tudo do Pro + escala. */
    ENTERPRISE(modulosProEUtc()),

    /** Personalizado — sem matriz; aplicação via toggle granular (400 na API de plano). */
    PERSONALIZADO(Set.of());

    private final Set<ModuloSistema> modulos;

    PlanoSaaS(Set<ModuloSistema> modulos) {
        this.modulos = Collections.unmodifiableSet(modulos);
    }

    public Set<ModuloSistema> getModulos() {
        return modulos;
    }

    public boolean inclui(ModuloSistema modulo) {
        return modulos.contains(modulo);
    }

    private static Set<ModuloSistema> modulosStartEUtc() {
        Set<ModuloSistema> s = EnumSet.copyOf(START.getModulos());
        s.addAll(Set.of(
                ModuloSistema.ORDEM_SERVICO,
                ModuloSistema.RECEITAS_CLINICAS,
                ModuloSistema.LAB_PORTAL,
                ModuloSistema.RASTREIO_CLIENTE,
                ModuloSistema.FINANCEIRO_COMPLETO,
                ModuloSistema.FISCAL_FLOWBOX,
                ModuloSistema.ESTOQUE_LOTES));
        return s;
    }

    private static Set<ModuloSistema> modulosProEUtc() {
        Set<ModuloSistema> s = EnumSet.copyOf(PRO.getModulos());
        s.addAll(Set.of(
                ModuloSistema.COMPRAS_XML,
                ModuloSistema.ETIQUETAS,
                ModuloSistema.SUGESTAO_COMPRAS,
                ModuloSistema.SCANNER_MOVEL,
                ModuloSistema.TABELAS_PRECO,
                ModuloSistema.FIDELIDADE_PONTOS,
                ModuloSistema.ORCAMENTO_ONLINE,
                ModuloSistema.KITS_COMBOS,
                ModuloSistema.ALERTAS_TELEGRAM));
        return s;
    }

    /**
     * Resolve o plano a partir do nome enviado na API.
     *
     * @throws IllegalArgumentException (400) para nome desconhecido
     */
    public static PlanoSaaS deNome(String nome) {
        if (nome == null || nome.isBlank()) {
            throw new IllegalArgumentException("Plano ausente. Use START, PRO ou ENTERPRISE.");
        }
        try {
            return valueOf(nome.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Plano inválido: '" + nome
                    + "'. Use START, PRO ou ENTERPRISE.");
        }
    }

    /**
     * Plano correspondente a um conjunto ativo, ou null se não bater com nenhuma matriz.
     * Usado para derivar o {@code planoAtual} exibido no Painel do Desenvolvedor.
     */
    public static PlanoSaaS compativelCom(Set<ModuloSistema> ativos) {
        for (PlanoSaaS plano : values()) {
            if (plano == PERSONALIZADO) {
                continue;
            }
            if (plano.modulos.equals(ativos)) {
                return plano;
            }
        }
        return null;
    }
}
