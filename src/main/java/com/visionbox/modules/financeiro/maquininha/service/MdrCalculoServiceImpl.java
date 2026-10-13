package com.visionbox.modules.financeiro.maquininha.service;

import com.visionbox.modules.financeiro.maquininha.domain.FaixaMdr;
import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.domain.TipoCartao;
import com.visionbox.modules.financeiro.maquininha.dto.ResultadoMdr;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Cálculo MDR (§3.5):
 * <pre>taxaValor = valor * (taxaPercentual / 100) + taxaFixa
 * valorLiquido = valor - taxaValor</pre>
 * Precisão: HALF_EVEN com 2 casas (banco) — percentual intermediário com 6 casas.
 * Sem taxa/alíquota de imposto hard-coded (R3): os percentuais vêm sempre do cadastro da loja.
 */
@Service
public class MdrCalculoServiceImpl implements MdrCalculoService {

    private static final BigDecimal CIEN = BigDecimal.valueOf(100);

    @Override
    public ResultadoMdr calcular(BigDecimal valor, MaquininhaCartao maquininha, TipoCartao tipo, int parcelas) {
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("valor deve ser > 0 para cálculo de MDR");
        }
        if (maquininha == null) {
            throw new IllegalArgumentException("maquininha obrigatória");
        }
        if (tipo == null) {
            throw new IllegalArgumentException("tipo de cartão obrigatório");
        }
        if (parcelas < 1) {
            throw new IllegalArgumentException("parcelas deve ser >= 1");
        }

        FaixaMdr faixa = resolverFaixa(tipo, parcelas);
        BigDecimal percentual = percentualDaFaixa(maquininha, faixa);
        BigDecimal taxaFixa = taxaFixaDaFaixa(maquininha, faixa);

        BigDecimal bruto = valor.setScale(2, RoundingMode.HALF_EVEN);
        BigDecimal taxaPercentualParte = bruto.multiply(percentual).divide(CIEN, 6, RoundingMode.HALF_EVEN);
        BigDecimal taxaValor = taxaPercentualParte.add(taxaFixa).setScale(2, RoundingMode.HALF_EVEN);
        BigDecimal liquido = bruto.subtract(taxaValor).setScale(2, RoundingMode.HALF_EVEN);

        return ResultadoMdr.builder()
                .maquininhaId(maquininha.getId())
                .tipo(tipo.name())
                .parcelas(faixa == FaixaMdr.DEBITO ? 1 : parcelas)
                .faixa(faixa.name())
                .valorBruto(bruto)
                .taxaPercentual(percentual)
                .taxaFixa(taxaFixa)
                .taxaValor(taxaValor)
                .valorLiquido(liquido)
                .build();
    }

    private FaixaMdr resolverFaixa(TipoCartao tipo, int parcelas) {
        if (tipo == TipoCartao.DEBITO) {
            if (parcelas > 1) {
                throw new IllegalArgumentException("Débito não parcela: informe parcelas = 1");
            }
            return FaixaMdr.DEBITO;
        }
        return switch (parcelas) {
            case 1 -> FaixaMdr.CREDITO_1X;
            case 2, 3, 4, 5, 6 -> FaixaMdr.CREDITO_2_6;
            case 7, 8, 9, 10, 11, 12 -> FaixaMdr.CREDITO_7_12;
            default -> throw new IllegalArgumentException(
                    "Crédito acima de 12x não tem faixa de taxa cadastrada (parcelas=" + parcelas + ")");
        };
    }

    private BigDecimal percentualDaFaixa(MaquininhaCartao m, FaixaMdr faixa) {
        return switch (faixa) {
            case DEBITO -> nuloZero(m.getDebitoTaxaPercentual());
            case CREDITO_1X -> nuloZero(m.getCredito1xTaxaPercentual());
            case CREDITO_2_6 -> nuloZero(m.getCredito2a6TaxaPercentual());
            case CREDITO_7_12 -> nuloZero(m.getCredito7a12TaxaPercentual());
        };
    }

    private BigDecimal taxaFixaDaFaixa(MaquininhaCartao m, FaixaMdr faixa) {
        return switch (faixa) {
            case DEBITO -> nuloZero(m.getDebitoTaxaFixa());
            case CREDITO_1X -> nuloZero(m.getCredito1xTaxaFixa());
            case CREDITO_2_6 -> nuloZero(m.getCredito2a6TaxaFixa());
            case CREDITO_7_12 -> nuloZero(m.getCredito7a12TaxaFixa());
        };
    }

    private BigDecimal nuloZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
