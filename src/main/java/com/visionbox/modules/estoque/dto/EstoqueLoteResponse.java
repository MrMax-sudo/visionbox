package com.visionbox.modules.estoque.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EstoqueLoteResponse {

    private UUID id;
    private UUID lojaId;
    private UUID produtoId;
    private String lote;
    private LocalDate validade;
    private Integer quantidade;
    private Boolean bloqueado;
    private String motivoBloqueio;
    private boolean vencido;
    private boolean recallCandidato;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;
}
