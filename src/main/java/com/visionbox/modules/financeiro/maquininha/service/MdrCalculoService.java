package com.visionbox.modules.financeiro.maquininha.service;

import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.domain.TipoCartao;
import com.visionbox.modules.financeiro.maquininha.dto.ResultadoMdr;

import java.math.BigDecimal;

/**
 * Porta de cálculo de líquido MDR (§3.5) — reutilizável por baixas de conta a receber,
 * pagamentos de venda/PDV e conciliação bancária. Implementação: {@link MdrCalculoServiceImpl}.
 */
public interface MdrCalculoService {

    /**
     * Calcula taxa e líquido de um pagamento em cartão para a maquininha informada.
     *
     * @param valor      valor bruto (> 0)
     * @param maquininha cadastro de taxas (loja corrente — a porta não consulta tenant)
     * @param tipo       DEBITO (à vista) ou CREDITO
     * @param parcelas   nº de parcelas (>= 1; débito exige 1; crédito até 12)
     * @throws IllegalArgumentException valor inválido ou combinação tipo/parcelas sem faixa
     */
    ResultadoMdr calcular(BigDecimal valor, MaquininhaCartao maquininha, TipoCartao tipo, int parcelas);
}
