package com.visionbox.modules.vendas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PedidoVendaRequest {
    @NotBlank
    private String clienteNome;
    private UUID clienteId;
    @NotEmpty
    private List<ItemRequest> itens;
    private String observacao;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ItemRequest {
        @NotBlank private String sku;
        private int quantidade;
        private String precoUnitario; // BigDecimal string para evitar binário
    }
}
