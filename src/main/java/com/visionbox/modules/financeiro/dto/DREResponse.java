package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DREResponse {

    private UUID lojaId;
    private LocalDate inicio;
    private LocalDate fim;
    // Receita bruta (OS + PedidoVenda via conta_receber)
    private BigDecimal receita;
    // Custo (conta_pagar)
    private BigDecimal custo;
    // Comissão (percentual sobre receita ou custo marcado como comissão)
    private BigDecimal comissao;
    // DRE = receita - custo - comissao
    private BigDecimal dre;
    // Observação / detalhamento simples
    private String observacao;

    // Métricas auxiliares para relatório
    private BigDecimal margemPercentual; // dre / receita *100
    private long totalContasReceber;
    private long totalContasPagar;
}
