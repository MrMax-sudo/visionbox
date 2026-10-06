package com.visionbox.modules.fiscal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NfceEmitirRequest {

    private UUID pedidoId;

    private UUID ordemServicoId;

    private UUID clienteId;

    /** Série NFC-e — padrão 1 ou 001. Se nulo, usa "1" */
    private String serie;

    /** Número sequencial — se nulo, auto-incrementa por loja */
    private Integer numero;

    /** Modelo: NFCE_65 (default) ou NFE_55 */
    private String modelo;

    /** Ambiente: 1 produção, 2 homologação (default 2) */
    private String ambiente;

    /** XML assinado opcional — se nulo, mock gera chave fake */
    private String xmlAssinado;

    /** Chave de acesso opcional — 44 dígitos; se nulo mock gera */
    private String chaveAcesso;

    /** Valor total para log/teste (não fiscal real) */
    private String valorTotal;
}
