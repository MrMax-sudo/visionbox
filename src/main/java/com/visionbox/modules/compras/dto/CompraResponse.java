package com.visionbox.modules.compras.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompraResponse {
    private UUID id;
    private UUID lojaId;
    private String numero;
    private String serie;
    private String chaveAcesso;
    private String dataEmissao;
    private String fornecedorNome;
    private String fornecedorCnpj;
    private BigDecimal valorSubtotal;
    private BigDecimal desconto;
    private BigDecimal frete;
    private BigDecimal valorTotal;
    private String status;
    /** Populado no detalhe e na importação; nulo na listagem resumida. */
    private List<CompraItemResponse> itens;
    /** Títulos em Conta a Pagar gerados na importação. */
    private List<UUID> contasPagarIds;
}
