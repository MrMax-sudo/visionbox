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

    /**
     * Destinatário. Para NF-e (55) a SEFAZ exige endereço completo (logradouro, número, bairro,
     * município, UF e CEP); o Flowbox monta {@code enderDest} com esses campos. Para NFC-e (65)
     * eles são opcionais (consumidor identificado só pelo CPF).
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DestinatarioRequest {
        private String cpf;
        private String nome;
        /** IE do destinatário; quando informada e válida, vira indIEDest=1. */
        private String inscricaoEstadual;
        private String logradouro;
        private String numero;
        private String bairro;
        /** Código IBGE de 7 dígitos. */
        private String codigoMunicipio;
        private String municipio;
        private String uf;
        /** CEP de 8 dígitos, sem pontuação. */
        private String cep;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemFiscalRequest {
        private Integer numeroItem;
        private String codigo;
        private String descricao;
        private String ncm;
        private String cest;
        private String cfop;
        private String csosn;
        private String cst;
        private String unidade;
        private java.math.BigDecimal quantidade;
        private java.math.BigDecimal valorUnitario;
        private java.math.BigDecimal valorTotal;
        private java.math.BigDecimal valorDesconto;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PagamentoFiscalRequest {
        private String meio;
        private java.math.BigDecimal valor;
    }

    private DestinatarioRequest destinatario;
    private java.util.List<ItemFiscalRequest> itens;
    private java.util.List<PagamentoFiscalRequest> pagamentos;
}
