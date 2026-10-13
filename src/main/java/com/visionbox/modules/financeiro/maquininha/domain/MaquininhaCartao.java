package com.visionbox.modules.financeiro.maquininha.domain;

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

/**
 * Maquininha/POS com taxas MDR (§3.5): taxa percentual e taxa fixa por operação/faixa.
 * <p>
 * Cálculo: {@code taxaValor = valor * (taxaPercentual/100) + taxaFixa};
 * {@code valorLiquido = valor - taxaValor} (ver {@code MdrCalculoService}).
 * Débito é à vista; crédito por faixa de parcelas 1x, 2-6x e 7-12x.
 */
@Entity
@Table(name = "maquininha_cartao")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class MaquininhaCartao extends EntidadeBase {

    @Column(name = "nome", nullable = false, length = 100)
    private String nome;

    @Column(name = "adquirente", nullable = false, length = 50)
    private String adquirente;

    @Column(name = "debito_taxa_percentual", nullable = false, precision = 7, scale = 4)
    @lombok.Builder.Default
    private BigDecimal debitoTaxaPercentual = BigDecimal.ZERO;

    @Column(name = "debito_taxa_fixa", nullable = false, precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal debitoTaxaFixa = BigDecimal.ZERO;

    @Column(name = "credito_1x_taxa_percentual", nullable = false, precision = 7, scale = 4)
    @lombok.Builder.Default
    private BigDecimal credito1xTaxaPercentual = BigDecimal.ZERO;

    @Column(name = "credito_1x_taxa_fixa", nullable = false, precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal credito1xTaxaFixa = BigDecimal.ZERO;

    @Column(name = "credito_2_6_taxa_percentual", nullable = false, precision = 7, scale = 4)
    @lombok.Builder.Default
    private BigDecimal credito2a6TaxaPercentual = BigDecimal.ZERO;

    @Column(name = "credito_2_6_taxa_fixa", nullable = false, precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal credito2a6TaxaFixa = BigDecimal.ZERO;

    @Column(name = "credito_7_12_taxa_percentual", nullable = false, precision = 7, scale = 4)
    @lombok.Builder.Default
    private BigDecimal credito7a12TaxaPercentual = BigDecimal.ZERO;

    @Column(name = "credito_7_12_taxa_fixa", nullable = false, precision = 12, scale = 2)
    @lombok.Builder.Default
    private BigDecimal credito7a12TaxaFixa = BigDecimal.ZERO;
}
