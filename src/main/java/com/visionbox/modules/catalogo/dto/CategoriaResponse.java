package com.visionbox.modules.catalogo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoriaResponse {
    private UUID id;
    private UUID lojaId;
    private String nome;
    private String descricao;
    private boolean ativo;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;
}
