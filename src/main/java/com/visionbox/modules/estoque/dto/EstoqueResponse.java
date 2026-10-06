package com.visionbox.modules.estoque.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EstoqueResponse {

    private UUID id;
    private UUID lojaId;
    private UUID produtoId;
    private Integer quantidade;
    private Integer reservado;
    private Integer disponivel;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;
}
