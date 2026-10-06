package com.visionbox.modules.caixa.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "caixa_sessao")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class CaixaSessao extends EntidadeBase {

    public enum StatusCaixa { ABERTO, FECHADO }

    @Column(name = "usuario_id", nullable = false)
    private UUID usuarioId;

    @Column(name = "operador_nome", length = 120)
    private String operadorNome;

    @Column(name = "identificacao_caixa", length = 50, nullable = false)
    @Builder.Default
    private String identificacaoCaixa = "CAIXA_01";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    @Builder.Default
    private StatusCaixa status = StatusCaixa.ABERTO;

    @Column(name = "aberto_em", columnDefinition = "timestamptz", nullable = false)
    @Builder.Default
    private OffsetDateTime abertoEm = OffsetDateTime.now();

    @Column(name = "fechado_em", columnDefinition = "timestamptz")
    private OffsetDateTime fechadoEm;

    @Column(name = "saldo_inicial", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal saldoInicial = BigDecimal.ZERO;

    @Column(name = "total_entradas", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalEntradas = BigDecimal.ZERO;

    @Column(name = "total_saidas", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalSaidas = BigDecimal.ZERO;

    @Column(name = "saldo_esperado", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal saldoEsperado = BigDecimal.ZERO;

    @Column(name = "saldo_informado_fechamento", precision = 12, scale = 2)
    private BigDecimal saldoInformadoFechamento;

    @Column(name = "diferenca_fechamento", precision = 12, scale = 2)
    private BigDecimal diferencaFechamento;

    @Column(name = "observacao_fechamento", length = 500)
    private String observacaoFechamento;

    @OneToMany(mappedBy = "sessao", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("criadoEm ASC")
    @Builder.Default
    private List<CaixaMovimento> movimentos = new ArrayList<>();
}
