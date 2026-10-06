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
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "conta_receber")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class ContaReceber extends EntidadeBase {

    public enum StatusConta { PENDENTE, PAGO, VENCIDO, CANCELADO, PARCIAL }

    @Column(name = "cliente_id")
    private UUID clienteId;

    @Column(name = "pedido_id")
    private UUID pedidoId;

    @Column(name = "ordem_servico_id")
    private UUID ordemServicoId;

    @Column(name = "descricao", length = 500)
    private String descricao;

    @Column(name = "numero_documento", length = 50)
    private String numeroDocumento;

    @Column(name = "valor", precision = 12, scale = 2, nullable = false)
    private BigDecimal valor;

    @Column(name = "valor_pago", precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal valorPago = BigDecimal.ZERO;

    @Column(name = "vencimento", nullable = false)
    private LocalDate vencimento;

    @Column(name = "data_pagamento", columnDefinition = "timestamptz")
    private OffsetDateTime dataPagamento;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @lombok.Builder.Default
    private StatusConta status = StatusConta.PENDENTE;

    @Column(name = "parcela")
    private Integer parcela;

    @Column(name = "total_parcelas")
    private Integer totalParcelas;

    /** Garante escala HALF_EVEN 2 casas */
    public void normalizarValor() {
        if (this.valor != null) {
            this.valor = this.valor.setScale(2, RoundingMode.HALF_EVEN);
        }
        if (this.valorPago != null) {
            this.valorPago = this.valorPago.setScale(2, RoundingMode.HALF_EVEN);
        }
    }

    public BigDecimal getSaldo() {
        BigDecimal v = valor != null ? valor : BigDecimal.ZERO;
        BigDecimal p = valorPago != null ? valorPago : BigDecimal.ZERO;
        return v.subtract(p).setScale(2, RoundingMode.HALF_EVEN);
    }

    public boolean isVencida() {
        return status == StatusConta.PENDENTE && vencimento != null && vencimento.isBefore(LocalDate.now());
    }
}
