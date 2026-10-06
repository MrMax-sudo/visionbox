package com.visionbox.modules.vendas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PedidoVendaResponse {
    private UUID id;
    private UUID lojaId;
    private String numero;
    private String status;
}
