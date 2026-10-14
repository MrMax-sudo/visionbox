package com.visionbox.modules.fiscal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FiscalConfigRequest {
    private String flowboxUrl;
    private String flowboxApiKey;
    private String flowboxWebUrl;
    /** Referência ao certificado A1 no Flowbox; null preserva o valor atual. */
    private Long flowboxCertificadoId;
    /**
     * Cadastro fiscal do emitente. Null preserva o valor atual; string vazia limpa o campo.
     * Inscrição Estadual e CSC/CSC Id são obrigatórios para a SEFAZ autorizar a NFC-e.
     */
    private String inscricaoEstadual;
    private String csc;
    private String cscId;
    private String codigoMunicipio;
    private String crt;
    private String fiscalAmbiente;
}
