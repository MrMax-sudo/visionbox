package com.visionbox.modules.clinico.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReceitaResponse {
    private UUID id;
    private UUID lojaId;
    private UUID clienteId;
    /** Nome do cliente (exibição na UI — evita round-trip extra no frontend). */
    private String clienteNome;
    private String dataEmissao;
    private String dataValidade;
    private String nomeMedico;
    private String crmMedico;
    private GrauDto od;
    private GrauDto oe;
    private BigDecimal dp;
    private String tipo;
    private String observacao;
    private String anexoS3Key;
    private String anexoS3Bucket;
    private boolean ativo;
    private OffsetDateTime criadoEm;
}
