package com.visionbox.modules.financeiro.comissao.domain;

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
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Lançamento de comissão apurado em uma venda (§3.6), vinculado ao vendedor/usuário.
 * Idempotência por (loja, venda, vendedor, base) via índice único parcial em V35.
 * Sem FK para pedido_venda/usuario (D-005) — mesmos UUIDs do resto do sistema.
 */
@Entity
@Table(name = "comissao_lancamento")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class ComissaoLancamento extends EntidadeBase {

    public enum StatusComissao { PENDENTE, PAGO, CANCELADO }

    @Column(name = "venda_id")
    private UUID vendaId;

    @Column(name = "venda_numero", length = 30)
    private String vendaNumero;

    @Column(name = "vendedor_id", nullable = false)
    private UUID vendedorId;

    @Column(name = "vendedor_nome", length = 150)
    private String vendedorNome;

    /** Categoria específica coberta pela regra; nula = base geral. */
    @Column(name = "categoria", length = 100)
    private String categoria;

    @Column(name = "base_calculo", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseCalculo;

    @Column(name = "percentual_aplicado", nullable = false, precision = 5, scale = 2)
    private BigDecimal percentualAplicado;

    @Column(name = "valor_comissao", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorComissao;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @lombok.Builder.Default
    private StatusComissao status = StatusComissao.PENDENTE;

    @Column(name = "data_lancamento", nullable = false, columnDefinition = "timestamptz")
    @lombok.Builder.Default
    private OffsetDateTime dataLancamento = OffsetDateTime.now();
}
