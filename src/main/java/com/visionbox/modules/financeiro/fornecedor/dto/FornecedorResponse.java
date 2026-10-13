package com.visionbox.modules.financeiro.fornecedor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Response de Fornecedor — CNPJ nunca em plain, apenas mascarado (LGPD/ADR-002). */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FornecedorResponse {

    private UUID id;
    private UUID lojaId;
    private String nome;
    /** CNPJ parcialmente mascarado (dois primeiros dígitos visíveis, resto oculto) ou null se sem CNPJ. */
    private String cnpjMasked;
    private String contato;
    private String telefone;
    private String email;
    private boolean ativo;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;
}
