package com.visionbox.modules.ordemservico.domain;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * Registry Pattern — valida transições sem Spring StateMachine.
 * Fonte: arquivo.md §8 PERMITIDAS + GOVERNANCE DoD cobertura ≥95% OS.
 * <p>
 * REGRA crítica R6: toda transição OS validada aqui e gera EventoOS.
 */
@Component
public class TransicaoOSRegistry {

    private static final Map<StatusOS, Set<StatusOS>> PERMITIDAS;

    static {
        Map<StatusOS, Set<StatusOS>> m = new EnumMap<>(StatusOS.class);
        m.put(StatusOS.ORCAMENTO, Set.of(StatusOS.PEDIDO_CONFIRMADO, StatusOS.CANCELADO));
        m.put(StatusOS.PEDIDO_CONFIRMADO, Set.of(StatusOS.ENVIADO_LABORATORIO, StatusOS.CANCELADO));
        m.put(StatusOS.ENVIADO_LABORATORIO, Set.of(StatusOS.EM_PRODUCAO, StatusOS.RETRABALHO, StatusOS.CANCELADO));
        m.put(StatusOS.EM_PRODUCAO, Set.of(StatusOS.LENTE_PRONTA, StatusOS.RETRABALHO));
        m.put(StatusOS.LENTE_PRONTA, Set.of(StatusOS.MONTAGEM));
        m.put(StatusOS.MONTAGEM, Set.of(StatusOS.CONTROLE_QUALIDADE, StatusOS.RETRABALHO));
        m.put(StatusOS.CONTROLE_QUALIDADE, Set.of(StatusOS.PRONTO_PARA_RETIRADA, StatusOS.RETRABALHO));
        m.put(StatusOS.PRONTO_PARA_RETIRADA, Set.of(StatusOS.ENTREGUE, StatusOS.DEVOLVIDO_GARANTIA));
        m.put(StatusOS.RETRABALHO, Set.of(StatusOS.ENVIADO_LABORATORIO, StatusOS.EM_PRODUCAO));
        // Terminais: vazio
        m.put(StatusOS.ENTREGUE, Set.of());
        m.put(StatusOS.CANCELADO, Set.of());
        m.put(StatusOS.DEVOLVIDO_GARANTIA, Set.of());
        PERMITIDAS = Collections.unmodifiableMap(m);
    }

    public boolean podeTransitar(StatusOS origem, StatusOS destino) {
        if (origem == null || destino == null) return false;
        return PERMITIDAS.getOrDefault(origem, Set.of()).contains(destino);
    }

    public void validarTransicao(StatusOS origem, StatusOS destino) {
        if (!podeTransitar(origem, destino)) {
            throw new TransicaoInvalidaException(origem, destino);
        }
    }

    public Set<StatusOS> destinosPermitidos(StatusOS origem) {
        return PERMITIDAS.getOrDefault(origem, Set.of());
    }

    public Map<StatusOS, Set<StatusOS>> todasTransicoes() {
        return PERMITIDAS;
    }

    public boolean isTerminal(StatusOS status) {
        return destinosPermitidos(status).isEmpty();
    }
}
