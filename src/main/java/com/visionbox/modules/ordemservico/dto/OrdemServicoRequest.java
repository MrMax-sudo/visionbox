package com.visionbox.modules.ordemservico.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrdemServicoRequest {
    @NotNull
    private UUID clienteId;
    private UUID receitaId;
    private UUID armacaoId;
    private UUID lenteId;
    private UUID laboratorioId;
    private String previsaoEntrega; // ISO OffsetDateTime opcional
    private String observacao;

    // PDV teclado-first: carrinho por SKU (compat com frontend)
    private List<ItemRequest> itens;
    private java.math.BigDecimal desconto;
    private String senhaAutorizacao;
    private String formaPagamento;
    private List<PagamentoRequest> pagamentos;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemRequest {
        private String sku;
        private Integer quantidade;
        private UUID produtoId; // opcional quando frontend já tem id
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PagamentoRequest {
        private UUID formaPagamentoId;
        private java.math.BigDecimal valor;
    }
}
