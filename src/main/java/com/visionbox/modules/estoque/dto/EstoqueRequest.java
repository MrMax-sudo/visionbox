package com.visionbox.modules.estoque.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EstoqueRequest {

    @NotNull
    private UUID produtoId;

    @NotNull @Min(0)
    private Integer quantidade;

    @Min(0)
    private Integer reservado;

    /** Para movimentações: qtd a reservar/baixar/estornar */
    private Integer delta;
}
