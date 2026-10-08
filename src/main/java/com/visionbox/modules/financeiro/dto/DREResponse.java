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

    // US13 — escopo opcional do DRE
    /** OS do filtro (null = DRE por loja). Receita filtra conta_receber.ordem_servico_id; custo filtra conta_pagar.ordem_servico_id (V29). */
    private UUID osId;
    /** Período informado como veio no request (ex.: "2026-10", "2026-01-01..2026-03-31") — null quando usado inicio/fim. */
    private String periodo;
}
