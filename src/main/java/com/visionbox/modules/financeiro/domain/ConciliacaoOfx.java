package com.visionbox.modules.financeiro.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;

/**
 * ConciliacaoOfx — linha de extrato OFX importada e o resultado da conciliação
 * contra {@link ContaReceber}/{@link ContaPagar} da mesma loja (US13).
 * <p>
 * Regras:
 * - Deduplicação por FITID único por loja ({@code (loja_id, fit_id)} UNIQUE) —
 *   reimportar o mesmo extrato não duplica linhas.
 * - Status: CONCILIADO (valor + data dentro da tolerância), DIVERGENTE
 *   (candidato encontrado com divergência), PENDENTE (sem correspondência).
 * - Evidência ONLY: conciliar NÃO dá baixa na conta (baixa continua em
 *   {@code /contas-receber/{id}/baixar} e {@code /contas-pagar/{id}/baixar}).
 * - Multi-tenant por loja_id (ADR-001), ativo soft-delete, RLS fail-closed.
 */
@Entity
@Table(name = "conciliacao_ofx")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class ConciliacaoOfx extends EntidadeBase {

    public enum StatusConciliacao { CONCILIADO, DIVERGENTE, PENDENTE }

    public enum TipoContaConciliacao { RECEBER, PAGAR }

    /** FITID do banco (único por loja). */
    @Column(name = "fit_id", nullable = false, length = 100)
    private String fitId;

    /** TRNTYPE do OFX (DEBIT, CREDIT, XFER, ...). */
    @Column(name = "trn_tipo", length = 20)
    private String trnTipo;

    /** DTPOSTED — data de postação no extrato. */
    @Column(name = "data_postamento", nullable = false)
    private LocalDate dataPostamento;

    /** TRNAMT com sinal original do banco (crédito positivo, débito negativo). */
    @Column(name = "valor", nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(name = "memo", length = 500)
    private String memo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @lombok.Builder.Default
    private StatusConciliacao status = StatusConciliacao.PENDENTE;

    /** Direção da conciliação: crédito -> RECEBER, débito -> PAGAR. */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_conta", length = 10)
    private TipoContaConciliacao tipoConta;

    @Column(name = "conta_receber_id")
    private UUID contaReceberId;

    @Column(name = "conta_pagar_id")
    private UUID contaPagarId;

    /** extrato (abs) - conta, HALF_EVEN 2 casas; nulo quando PENDENTE. */
    @Column(name = "diferenca_valor", precision = 12, scale = 2)
    private BigDecimal diferencaValor;

    @Column(name = "observacao", length = 300)
    private String observacao;

    /** Garante escala HALF_EVEN 2 casas no valor do extrato. */
    public void normalizarValor() {
        if (this.valor != null) {
            this.valor = this.valor.setScale(2, RoundingMode.HALF_EVEN);
        }
        if (this.diferencaValor != null) {
            this.diferencaValor = this.diferencaValor.setScale(2, RoundingMode.HALF_EVEN);
        }
    }
}
