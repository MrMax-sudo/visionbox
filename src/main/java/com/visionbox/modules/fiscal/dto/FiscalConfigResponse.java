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
    private String fiscalProvider;
    private boolean active;
}
