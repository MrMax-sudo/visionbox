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

/**
 * Regra de comissão de vendedores (§3.6): percentual geral sobre a venda ou
 * percentual por categoria de produto (ex.: lentes vs armações).
 * Unicidade por loja garantida por índices parciais em V35 (uma GERAL ativa; uma por categoria).
 */
@Entity
@Table(name = "comissao_config")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class ComissaoConfig extends EntidadeBase {

    public enum TipoComissao { GERAL, CATEGORIA }

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private TipoComissao tipo;

    /** Nome da categoria de produto (bate com produto.categoria, case-insensitive). Exige tipo CATEGORIA. */
    @Column(name = "categoria", length = 100)
    private String categoria;

    /** Percentual 0..100 (ex.: 5,00 = 5%). Sem alíquota de imposto — só comissão comercial. */
    @Column(name = "percentual", nullable = false, precision = 5, scale = 2)
    private BigDecimal percentual;
}
