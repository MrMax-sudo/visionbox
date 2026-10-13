package com.visionbox.modules.vendas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendaViewDTO {
    private UUID id;
    private String numero;
    private OffsetDateTime dataHora;
    private UUID clienteId;
    private String clienteNome;
    private String clienteCpf;
    private String clienteTelefone;
    private String clienteWhatsapp;

    // Status e valores
    private String status;
    private String statusDescricao;
    private BigDecimal subtotal;
    private BigDecimal desconto;
    private BigDecimal valorTotal;
    private String formaPagamento;

    // Dados fiscais (NFC-e / NF-e)
    private String statusFiscal; // NAO_EMITIDO, AUTORIZADO, REJEITADO, CONTINGENCIA, CANCELADO
    private String modeloFiscal;
    private String serieFiscal;
    private Integer numeroFiscal;
    private String chaveAcesso;
    private String protocoloFiscal;
    private OffsetDateTime dataAutorizacaoFiscal;
    private String qrCodeUrl;
    private String motivoFiscal;

    // Itens e Pagamentos
    @Builder.Default
    private List<VendaItemViewDTO> itens = new ArrayList<>();

    @Builder.Default
    private List<VendaPagamentoViewDTO> pagamentos = new ArrayList<>();

    private String observacao;
}
