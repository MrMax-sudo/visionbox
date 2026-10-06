package com.visionbox.modules.financeiro.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContaReceberRequest {

    private UUID clienteId;

    private UUID pedidoId;

    private UUID ordemServicoId;

    @NotNull @Positive
    private BigDecimal valor;

    @NotNull
    private String vencimento; // ISO LocalDate yyyy-MM-dd

    private String descricao;

    private String numeroDocumento;

    private Integer parcela;

    private Integer totalParcelas;

    /** Se não informado, usa clienteId do pedido/OS */
}
