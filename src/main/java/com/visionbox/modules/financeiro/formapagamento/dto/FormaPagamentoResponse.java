package com.visionbox.modules.financeiro.formapagamento.dto;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento.TipoFormaPagamento;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FormaPagamentoResponse {
    private UUID id;
    private String nome;
    private TipoFormaPagamento tipo;
    private boolean ativo;
    private boolean padrao;
    private BigDecimal taxaPercentual;
    private Integer prazoDias;
    private boolean permiteParcelar;
    private Integer maxParcelas;
    private String tPagNfce;
}
