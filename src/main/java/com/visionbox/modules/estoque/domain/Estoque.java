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

import java.util.UUID;

/**
 * Estoque — controle por produto/loja.
 * US09: estoque = quantidade física - reservado.
 * Reservar ao criar OS, baixar ao ENTREGUE, estornar ao CANCELADO.
 */
@Entity
@Table(name = "estoque", uniqueConstraints = @UniqueConstraint(name = "uk_estoque_loja_produto", columnNames = {"loja_id", "produto_id"}))
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Estoque extends EntidadeBase {

    @Column(name = "produto_id", nullable = false)
    private UUID produtoId;

    @Column(name = "quantidade", nullable = false)
    @lombok.Builder.Default
    private Integer quantidade = 0;

    @Column(name = "reservado", nullable = false)
    @lombok.Builder.Default
    private Integer reservado = 0;

    /** Disponível = quantidade - reservado (não persistido). */
    public int getDisponivel() {
        int q = quantidade != null ? quantidade : 0;
        int r = reservado != null ? reservado : 0;
        return q - r;
    }

    /** Quantidade total em mãos + reservado nunca negativo (validação serviço). */
    public void validarInvariantes() {
        int q = quantidade != null ? quantidade : 0;
        int r = reservado != null ? reservado : 0;
        if (q < 0) throw new IllegalStateException("quantidade não pode ser negativa");
        if (r < 0) throw new IllegalStateException("reservado não pode ser negativo");
        if (r > q) throw new IllegalStateException("reservado (" + r + ") não pode exceder quantidade (" + q + ")");
    }
}
