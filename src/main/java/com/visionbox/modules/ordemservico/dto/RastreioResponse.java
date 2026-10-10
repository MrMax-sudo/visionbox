package com.visionbox.modules.ordemservico.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Payload público do rastreio da OS (US17 / §6.3) — Portal do Cliente.
 *
 * <p>Minimização LGPD: <b>não</b> expõe CPF, grau/receita nem o nome completo do
 * cliente (apenas o primeiro nome). O contrato é espelhado por
 * {@code apps/web/src/lib/rastreioApi.ts} (interface {@code RastreioOS}).
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class RastreioResponse {

    private UUID ordemServicoId;
    private String numeroOs;
    private String statusAtual;
    private OffsetDateTime dataAbertura;
    private OffsetDateTime previsaoEntrega;
    private OffsetDateTime dataEntregaReal;
    /** Somente o primeiro nome (minimização LGPD). */
    private String clientePrimeiroNome;
    private String produtoResumo;
    private String armacaoNome;
    private String lenteNome;
    private Optica optica;
    private Garantia garantia;
    private List<Evento> timeline;

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Optica {
        private String nome;
        private String cnpj;
        private String telefone;
        private String whatsapp;
        private String endereco;
        private String cidade;
        private String uf;
    }

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Garantia {
        private OffsetDateTime dataCompra;
        private Integer validadeMeses;
        private List<GarantiaItem> itens;
    }

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GarantiaItem {
        private String descricao;
        private Integer quantidade;
        private Integer garantiaMeses;
        private OffsetDateTime validade;
    }

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Evento {
        private UUID id;
        private String statusAnterior;
        private String statusNovo;
        private OffsetDateTime dataHora;
        private String responsavel;
        private String observacao;
    }
}