package com.visionbox.modules.ordemservico.domain;

public class TransicaoInvalidaException extends RuntimeException {

    private final StatusOS origem;
    private final StatusOS destino;

    public TransicaoInvalidaException(StatusOS origem, StatusOS destino) {
        super(String.format("Transição inválida: %s -> %s", origem, destino));
        this.origem = origem;
        this.destino = destino;
    }

    public StatusOS getOrigem() { return origem; }
    public StatusOS getDestino() { return destino; }
}
