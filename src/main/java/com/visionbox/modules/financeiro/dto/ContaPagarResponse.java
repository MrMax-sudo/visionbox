package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContaPagarResponse {

    private UUID id;
    private UUID lojaId;
    private String fornecedor;
    private String descricao;
    private String numeroDocumento;
    private BigDecimal valor;
    private BigDecimal valorPago;
    private BigDecimal saldo;
    private LocalDate vencimento;
    private OffsetDateTime dataPagamento;
    private String status;
    private Integer parcela;
    private Integer totalParcelas;
    private OffsetDateTime criadoEm;
    private boolean vencida;
    /** US13 — vínculo opcional com ordem de serviço (custo direto da OS). */
    private UUID ordemServicoId;
}
