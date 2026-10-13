package com.visionbox.modules.financeiro.fornecedor.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request de Fornecedor. CNPJ opcional; se informado deve ter 14 dígitos
 * (com ou sem máscara) — validação por CnpjValidator + dedup por hash HMAC.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FornecedorRequest {

    @NotBlank(message = "nome é obrigatório")
    private String nome;

    /** CNPJ com ou sem máscara (14 dígitos). Cifrado no repouso (ADR-002). */
    private String cnpj;

    private String contato;

    private String telefone;

    private String email;
}
