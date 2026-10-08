package com.visionbox.modules.producao.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProducaoCQRequest {

    @NotNull(message = "Aprovado/reprovado é obrigatório")
    private Boolean aprovado;

    private String motivoReprovacao;

    private String fotoS3Key;

    private String fotoS3Bucket;

    private String fotoUrl;

    private String observacao;
}