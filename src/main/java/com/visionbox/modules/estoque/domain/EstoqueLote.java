package com.visionbox.modules.estoque.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDate;
import java.util.UUID;

/**
 * EstoqueLote — rastreio por lote/validade para recall (LGPD/consumidor).
 * Permite identificar produtos com defeito/contaminação e bloquear venda/entrega.
 * Multi-tenant por loja_id, RLS fail-closed.
 */
@Entity
@Table(name = "estoque_lote", uniqueConstraints = @UniqueConstraint(name = "uk_estoque_lote_loja_produto_lote", columnNames = {"loja_id", "produto_id", "lote"}))
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class EstoqueLote extends EntidadeBase {

    @Column(name = "produto_id", nullable = false)
    private UUID produtoId;

    @Column(name = "lote", nullable = false, length = 50)
    private String lote;

    @Column(name = "validade")
    private LocalDate validade;

    @Column(name = "quantidade", nullable = false)
    @lombok.Builder.Default
    private Integer quantidade = 0;

    @Column(name = "bloqueado", nullable = false)
    @lombok.Builder.Default
    private Boolean bloqueado = false;

    @Column(name = "motivo_bloqueio", length = 500)
    private String motivoBloqueio;

    public boolean isVencido() {
        return validade != null && validade.isBefore(LocalDate.now());
    }

    public boolean isRecallCandidato() {
        return Boolean.TRUE.equals(bloqueado) || isVencido();
    }

    public void validarInvariantes() {
        if (produtoId == null) throw new IllegalStateException("produtoId obrigatório");
        if (lote == null || lote.isBlank()) throw new IllegalStateException("lote obrigatório");
        if (lote.length() > 50) throw new IllegalStateException("lote máximo 50 caracteres");
        if (quantidade == null || quantidade < 0) throw new IllegalStateException("quantidade não pode ser negativa");
    }
}
