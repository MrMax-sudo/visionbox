package com.visionbox.modules.financeiro.comissao.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComissaoLancamentoResponse {
    private UUID id;
    private UUID vendaId;
    private String vendaNumero;
    private UUID vendedorId;
    private String vendedorNome;
    private String categoria;
    private BigDecimal baseCalculo;
    private BigDecimal percentualAplicado;
    private BigDecimal valorComissao;
    private String status;
    private OffsetDateTime dataLancamento;
}
