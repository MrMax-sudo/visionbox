package com.visionbox.modules.financeiro.formapagamento.dto;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento.TipoFormaPagamento;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FormaPagamentoRequest {
    private String nome;
    private TipoFormaPagamento tipo;
    private Boolean ativo;
    private Boolean padrao;
    private BigDecimal taxaPercentual;
    private Integer prazoDias;
    private Boolean permiteParcelar;
    private Integer maxParcelas;
    private String tPagNfce;
}
