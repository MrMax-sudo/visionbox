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

    /**
     * MDR (§3.5) — taxa aplicada: {@code valor * (taxaPercentual/100) + taxaFixa}
     * da faixa da maquininha. Padrão (V37):
     * não-cartão identificado = 0; cartão sem maquininha resolvida = null (pendente).
     */
    @Column(name = "taxa_valor", precision = 12, scale = 2)
    private BigDecimal taxaValor;

    /**
     * MDR (§3.5) — líquido a receber: {@code valor - taxaValor}.
     * Não-cartão isento = valor; cartão com MDR pendente = null.
     */
    @Column(name = "valor_liquido", precision = 12, scale = 2)
    private BigDecimal valorLiquido;

    /**
     * Maquininha cuja taxa foi aplicada (§3.5). Resolução em
     * {@code OrdemServicoService#aplicarMdr}: id explícito do payload do PDV
     * ou única maquininha ativa da loja; null quando MDR não aplicado.
     */
    @Column(name = "maquininha_id")
    private UUID maquininhaId;

    /**
     * Parcelas do pagamento (§3.5), persistidas desde V40. 1 = à vista/débito/
     * não-cartão; crédito parcelável usa o payload do PDV — mesmo valor efetivo
     * do cálculo MDR ({@code OrdemServicoService#parcelasEfetivas}). Antes do V40
     * o payload tinha parcelas mas não persistia (follow-up D-017).
     */
    @Column(name = "parcelas", nullable = false)
    private Integer parcelas;
}