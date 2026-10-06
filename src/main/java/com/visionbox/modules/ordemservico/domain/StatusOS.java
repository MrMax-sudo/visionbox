package com.visionbox.modules.ordemservico.domain;

/**
 * Máquina de 12 status da OS — fonte: visionbox-especificacao.md:265-274 + arquivo.md §8.
 * Terminal = sem saída. CANCELADO/DEVOLVIDO_GARANTIA/ENTREGUE são finais.
 */
public enum StatusOS {
    ORCAMENTO,
    PEDIDO_CONFIRMADO,
    ENVIADO_LABORATORIO,
    EM_PRODUCAO,
    LENTE_PRONTA,
    MONTAGEM,
    CONTROLE_QUALIDADE,
    PRONTO_PARA_RETIRADA,
    ENTREGUE,
    CANCELADO,
    DEVOLVIDO_GARANTIA,
    RETRABALHO
}
