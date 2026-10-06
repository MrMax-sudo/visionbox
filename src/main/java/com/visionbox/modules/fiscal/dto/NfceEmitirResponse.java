package com.visionbox.modules.fiscal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NfceEmitirResponse {

    private UUID id;
    private UUID lojaId;
    private String modelo;
    private String serie;
    private Integer numero;
    private String chaveAcesso;
    private String protocolo;
    private String status;
    private String codigoStatus;
    private String motivo;
    private String xmlRetorno;
    private OffsetDateTime dhAutorizacao;
    private OffsetDateTime dhEmissao;
    private String ambiente;
    private String tpEmis;
    private boolean autorizado;
}
