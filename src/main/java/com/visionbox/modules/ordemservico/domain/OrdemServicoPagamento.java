package com.visionbox.modules.ordemservico.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Pagamento vinculado a uma Ordem de Serviço (multi-forma).
 * Uma venda pode ser paga com múltiplas formas (ex.: 50% PIX + 50% Crédito);
 * cada linha persiste formaPagamentoId + valor.
 */
@Entity
@Table(name = "ordem_servico_pagamento")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class OrdemServicoPagamento extends EntidadeBase {

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "forma_pagamento_id", nullable = false)
    private UUID formaPagamentoId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(length = 100)
    private String formaPagamentoNome; // snapshot para exibição histórica
}