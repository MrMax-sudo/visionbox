package com.visionbox.modules.crm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DTO para recall de receitas vencidas.
 * Expõe dados mínimos para contato com consentimento_recall=true (LGPD).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecallResponse {
    private UUID receitaId;
    private UUID clienteId;
    private String clienteNome;
    private String telefone;
    private String whatsapp;
    private String email;
    private String canalPreferido;
    private LocalDate dataValidade;
    private LocalDate dataEmissao;
    private String nomeMedico;
    private String observacao;
    private UUID lojaId;
    private OffsetDateTime criadoEm;
}
