package com.visionbox.modules.fiscal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Retorno do cancelamento. {@code cancelado=false} com cStat diferente de 135 significa que a
 * SEFAZ rejeitou o evento e o documento continua AUTORIZADO — o status do documento não muda.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NfceCancelarResponse {

    private String chaveAcesso;
    private String serie;
    private Integer numero;

    /** Status do documento após a operação: CANCELADO ou AUTORIZADO (rejeição mantém autorizado). */
    private String status;

    /** 135 quando o evento foi registrado; senão o cStat real devolvido pela SEFAZ. */
    private String codigoStatus;

    private String motivo;

    /** Protocolo do evento de cancelamento (não confundir com o da autorização). */
    private String protocoloEvento;

    private boolean cancelado;
}
