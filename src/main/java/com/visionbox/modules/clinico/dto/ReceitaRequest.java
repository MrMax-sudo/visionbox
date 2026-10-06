package com.visionbox.modules.clinico.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReceitaRequest {

    @NotNull
    private UUID clienteId;

    @NotNull
    private String dataEmissao; // yyyy-MM-dd

    @NotNull
    private String dataValidade;

    private String nomeMedico;
    private String crmMedico;

    @Valid
    private GrauDto od;

    @Valid
    private GrauDto oe;

    private String dp; // BigDecimal string opcional
    private String tipo; // VISAO_SIMPLES etc
    private String observacao;
    private String anexoS3Key;
    private String anexoS3Bucket;
}
