package com.visionbox.modules.vendas.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendaKpisDTO {
    private long totalVendas;
    private BigDecimal faturamentoTotal;
    private BigDecimal ticketMedio;
    private long cuponsEmitidos;
    private long cuponsNaoEmitidos;
    private long totalCanceladas;
}
