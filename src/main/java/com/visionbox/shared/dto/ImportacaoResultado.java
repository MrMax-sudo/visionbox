package com.visionbox.shared.dto;

import java.util.List;

public record ImportacaoResultado(
        int totalLinhas,
        int processadosComSucesso,
        int totalErros,
        List<String> erros
) {
    public static ImportacaoResultado sucesso(int total, int processados, List<String> erros) {
        return new ImportacaoResultado(total, processados, erros != null ? erros.size() : 0, erros != null ? erros : List.of());
    }
}
