package com.visionbox.modules.financeiro.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * ContaReceberPagamento — histórico de baixas de Conta a Receber (§3.3 Plano Robustez).
 * <p>
 * Cada baixa (parcial ou total) gera uma linha imutável. O valor é debitado de
 * {@code ContaReceber.valorAberto} (derivado de valor - valor_pago). Se zerar → PAGO; senão → PARCIAL.
 * Referência: Outbox ERP {@code entity/ContaReceberPagamento.java} (padrão ouro).
 * <p>
 * Multi-tenant por loja_id (ADR-001), RLS fail-closed (V34). caixa_id nullable:
 * baixa realizada sem turno de caixa aberto fica sem vínculo de turno (auditado por log WARN).
 */
@Entity
@Table(name = "conta_receber_pagamento")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class ContaReceberPagamento extends EntidadeBase {

    @Column(name = "conta_receber_id", nullable = false)
    private UUID contaReceberId;

    /** Turno de caixa aberto no momento do pagamento (null se nenhum caixa aberto). */
    @Column(name = "caixa_id")
    private UUID caixaId;

    /** Operador que recebeu (deriva do JWT — nameUUIDFromBytes(username), mesmo critério do CaixaController). */
    @Column(name = "usuario_id")
    private UUID usuarioId;

    @Column(name = "forma_pagamento_id")
    private UUID formaPagamentoId;

    @Column(name = "valor_pago", precision = 12, scale = 2, nullable = false)
    private BigDecimal valorPago;

    /**
     * V41 (D-021) — desconto concedido nesta baixa. Abate o valor_aberto JUNTO com
     * valorPago (quita parte do título sem dinheiro entrar); soma ao valor_pago
     * agregado da conta. Default 0 (coluna nullable com DEFAULT 0 no banco).
     */
    @Column(name = "valor_desconto", precision = 12, scale = 2)
    private BigDecimal valorDesconto;

    /**
     * V41 (D-021) — juros/multa pagos pelo cliente. NÃO altera valor_aberto: é
     * receita extra que entra no caixa somada ao valorPago. Default 0.
     */
    @Column(name = "valor_juros", precision = 12, scale = 2)
    private BigDecimal valorJuros;

    @Column(name = "data_pagamento", columnDefinition = "timestamptz", nullable = false)
    private OffsetDateTime dataPagamento;

    @Column(name = "observacao", length = 255)
    private String observacao;
}
