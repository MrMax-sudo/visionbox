package com.visionbox.modules.fiscal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FiscalConfigResponse {
    private String flowboxUrl;
    private String flowboxApiKey;
    private String flowboxWebUrl;
    /** Referência ao certificado A1 no Flowbox; null quando ainda não configurado. */
    private Long flowboxCertificadoId;
    /**
     * Cadastro fiscal do emitente. Null significa "ainda não cadastrado" — o provedor recusa a
     * emissão com mensagem apontando este painel em vez de deixar a SEFAZ rejeitar com cStat 209.
     */
    private String inscricaoEstadual;
    private String csc;
    private String cscId;
    private String codigoMunicipio;
    private String crt;
    private String fiscalAmbiente;
    private String fiscalProvider;
    private boolean active;
}
