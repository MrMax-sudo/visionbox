package com.visionbox.modules.estoque.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EstoqueLoteRequest {

    @NotNull(message = "produtoId é obrigatório")
    private UUID produtoId;

    @NotBlank(message = "lote é obrigatório")
    private String lote;

    /** ISO LocalDate yyyy-MM-dd */
    private String validade;

    @NotNull @Min(value = 0, message = "quantidade deve ser >=0")
    private Integer quantidade;
}
