package com.visionbox.modules.financeiro.comissao.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Apuração de comissão de uma venda (§3.6).
 * {@code itens} é opcional: quando presente, habilita regras por CATEGORIA;
 * sem itens, só a regra GERAL é aplicada sobre {@code valorTotal}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApurarComissaoRequest {

    /** Venda/ pedido vinculado (idempotência da apuração por venda+vendedor). */
    private UUID vendaId;

    private String vendaNumero;

    @NotNull(message = "vendedorId é obrigatório")
    private UUID vendedorId;

    private String vendedorNome;

    @NotNull(message = "valorTotal é obrigatório")
    @DecimalMin(value = "0.01", message = "valorTotal deve ser > 0")
    private BigDecimal valorTotal;

    private List<ItemApuracao> itens;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemApuracao {
        private String categoria;
        private BigDecimal subtotal;
    }
}
