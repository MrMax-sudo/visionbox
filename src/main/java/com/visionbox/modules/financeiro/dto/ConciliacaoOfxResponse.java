package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * ConciliacaoOfxResponse — linha de conciliação (GET /api/v1/financeiro/ofx/conciliacoes).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ConciliacaoOfxResponse {

    private UUID id;
    private UUID lojaId;
    private String fitId;
    private String trnTipo;
    private LocalDate dataPostamento;
    private BigDecimal valor;
    private String memo;
    /** CONCILIADO | DIVERGENTE | PENDENTE */
    private String status;
    /** RECEBER | PAGAR (direção da conciliação) */
    private String tipoConta;
    private UUID contaReceberId;
    private UUID contaPagarId;
    private BigDecimal diferencaValor;
    private String observacao;
    private OffsetDateTime criadoEm;
}