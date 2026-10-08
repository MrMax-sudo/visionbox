package com.visionbox.modules.producao.dto;

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
public class ProducaoResponse {

    private UUID id;
    private UUID lojaId;
    private UUID ordemServicoId;
    private String numeroOs;
    private String statusOs;
    private OffsetDateTime inicioProducao;
    private OffsetDateTime fimProducao;
    private Boolean cqAprovado;
    private String cqReprovadoMotivo;
    private String fotoS3Key;
    private String fotoS3Bucket;
    private String fotoUrl;
    private String responsavelNome;
    private String observacao;
}