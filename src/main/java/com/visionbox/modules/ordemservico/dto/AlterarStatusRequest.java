package com.visionbox.modules.ordemservico.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AlterarStatusRequest {
    @NotBlank
    private String novoStatus; // ex: PEDIDO_CONFIRMADO
    private String responsavel;
    private String observacao;
}
