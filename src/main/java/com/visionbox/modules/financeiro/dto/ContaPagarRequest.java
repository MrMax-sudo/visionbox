package com.visionbox.modules.financeiro.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContaPagarRequest {

    @NotBlank(message = "fornecedor é obrigatório")
    private String fornecedor;

    private String descricao;

    private String numeroDocumento;

    @NotNull @Positive
    private BigDecimal valor;

    @NotNull(message = "vencimento é obrigatório (yyyy-MM-dd)")
    private String vencimento; // ISO LocalDate yyyy-MM-dd

    private Integer parcela;

    private Integer totalParcelas;
}
