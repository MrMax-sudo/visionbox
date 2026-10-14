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
}
