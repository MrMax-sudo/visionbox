package com.visionbox.modules.orcamento.dto;

import jakarta.validation.constraints.NotBlank;
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
public class OrcamentoRequest {
    private UUID clienteId;
    @NotBlank
    private String clienteNome;
    private String clienteCpf;
    private String clienteTelefone;
    private UUID vendedorId;
    private String vendedorNome;
    private BigDecimal valorSubtotal;
    private BigDecimal desconto;
    private BigDecimal valorTotal;
    private Integer validadeDias;
    private String observacoes;
    private String condicoesPagamento;
    private List<OrcamentoItemRequest> itens;
}
