package com.visionbox.modules.financeiro.maquininha.service;

import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.domain.TipoCartao;
import com.visionbox.modules.financeiro.maquininha.dto.ResultadoMdr;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cálculo MDR (§3.5): taxaValor = valor * (taxaPercentual/100) + taxaFixa;
 * valorLiquido = valor - taxaValor. HALF_EVEN 2 casas.
 */
class MdrCalculoServiceImplTest {

    private final MdrCalculoServiceImpl service = new MdrCalculoServiceImpl();
    private MaquininhaCartao maquininha;

    @BeforeEach
    void setUp() {
        maquininha = MaquininhaCartao.builder()
                .lojaId(UUID.fromString("00000000-0000-0000-0000-000000000001"))
                .nome("Stone Smart")
                .adquirente("STONE")
                .debitoTaxaPercentual(new BigDecimal("0.79"))
                .debitoTaxaFixa(new BigDecimal("0.29"))
                .credito1xTaxaPercentual(new BigDecimal("1.99"))
                .credito1xTaxaFixa(new BigDecimal("0.39"))
                .credito2a6TaxaPercentual(new BigDecimal("3.15"))
                .credito2a6TaxaFixa(new BigDecimal("0.39"))
                .credito7a12TaxaPercentual(new BigDecimal("4.49"))
                .credito7a12TaxaFixa(new BigDecimal("0.39"))
                .build();
        maquininha.setId(UUID.randomUUID());
    }

    @Test
    void calcular_credito1x_100_com199Mais039() {
        ResultadoMdr r = service.calcular(new BigDecimal("100.00"), maquininha, TipoCartao.CREDITO, 1);

        assertThat(r.getFaixa()).isEqualTo("CREDITO_1X");
        assertThat(r.getTaxaPercentual()).isEqualByComparingTo("1.99");
        assertThat(r.getTaxaFixa()).isEqualByComparingTo("0.39");
        assertThat(r.getTaxaValor()).isEqualByComparingTo("2.38"); // 100 * 1.99% + 0.39
        assertThat(r.getValorLiquido()).isEqualByComparingTo("97.62");
        assertThat(r.getValorLiquido().add(r.getTaxaValor())).isEqualByComparingTo("100.00");
    }

    @Test
    void calcular_credito2a6_faixaDeParcelamento() {
        ResultadoMdr r = service.calcular(new BigDecimal("1000.00"), maquininha, TipoCartao.CREDITO, 3);

        assertThat(r.getFaixa()).isEqualTo("CREDITO_2_6");
        assertThat(r.getParcelas()).isEqualTo(3);
        assertThat(r.getTaxaValor()).isEqualByComparingTo("31.89"); // 1000*3.15% = 31.50 + 0.39
        assertThat(r.getValorLiquido()).isEqualByComparingTo("968.11");
    }

    @Test
    void calcular_credito7a12_faixaDeParcelamento() {
        ResultadoMdr r = service.calcular(new BigDecimal("100.00"), maquininha, TipoCartao.CREDITO, 12);

        assertThat(r.getFaixa()).isEqualTo("CREDITO_7_12");
        assertThat(r.getTaxaValor()).isEqualByComparingTo("4.88"); // 100*4.49% = 4.49 + 0.39
        assertThat(r.getValorLiquido()).isEqualByComparingTo("95.12");
    }

    @Test
    void calcular_debito_aVista() {
        ResultadoMdr r = service.calcular(new BigDecimal("250.00"), maquininha, TipoCartao.DEBITO, 1);

        assertThat(r.getFaixa()).isEqualTo("DEBITO");
        // 250*0.79% = 1.975 + 0.29 = 2.265 → HALF_EVEN 2 casas = 2.26 (6 par fica)
        assertThat(r.getTaxaValor()).isEqualByComparingTo("2.26");
        assertThat(r.getValorLiquido()).isEqualByComparingTo("247.74");
    }

    @Test
    void calcular_arredondamentoHalfEvenDuasCasas() {
        // 10 * 1.99% = 0.199 -> 0.20 (HALF_EVEN) + 0.39 = 0.59
        ResultadoMdr r = service.calcular(new BigDecimal("10.00"), maquininha, TipoCartao.CREDITO, 1);
        assertThat(r.getTaxaValor()).isEqualByComparingTo("0.59");
        assertThat(r.getValorLiquido()).isEqualByComparingTo("9.41");
        assertThat(r.getTaxaValor().scale()).isEqualTo(2);
        assertThat(r.getValorLiquido().scale()).isEqualTo(2);
    }

    @Test
    void calcular_debitoParcelado_lancaIllegalArgument() {
        assertThatThrownBy(() -> service.calcular(new BigDecimal("100"), maquininha, TipoCartao.DEBITO, 3))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Débito não parcela");
    }

    @Test
    void calcular_creditoAcimaDe12x_lancaIllegalArgument() {
        assertThatThrownBy(() -> service.calcular(new BigDecimal("100"), maquininha, TipoCartao.CREDITO, 13))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("12x");
    }

    @Test
    void calcular_valorZeradoOuNulo_lancaIllegalArgument() {
        assertThatThrownBy(() -> service.calcular(BigDecimal.ZERO, maquininha, TipoCartao.CREDITO, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.calcular(null, maquininha, TipoCartao.CREDITO, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.calcular(new BigDecimal("-5"), maquininha, TipoCartao.CREDITO, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void calcular_semTaxaCadastrada_liquidoIgualAoBruto() {
        MaquininhaCartao zerada = MaquininhaCartao.builder()
                .lojaId(maquininha.getLojaId())
                .nome("Zero")
                .adquirente("OUTRA")
                .build();
        zerada.setId(UUID.randomUUID());

        ResultadoMdr r = service.calcular(new BigDecimal("88.88"), zerada, TipoCartao.DEBITO, 1);

        assertThat(r.getTaxaValor()).isEqualByComparingTo("0.00");
        assertThat(r.getValorLiquido()).isEqualByComparingTo("88.88");
    }
}
