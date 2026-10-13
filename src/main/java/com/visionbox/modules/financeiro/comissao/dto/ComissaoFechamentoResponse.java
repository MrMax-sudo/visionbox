package com.visionbox.modules.financeiro.comissao.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Fechamento de comissões por período (§3.6) — pagamento na folha/vale. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComissaoFechamentoResponse {

    private String dataInicio;
    private String dataFim;
    private Integer quantidadeLancamentos;
    private BigDecimal totalBase;
    private BigDecimal totalComissao;
    private List<ComissaoVendedorFechamento> porVendedor;
    /**
     * Linhas do período (uma por lançamento apurado/venda), com os mesmos filtros do
     * agregado: cancelados e inativos fora, mesmo vendedorId quando informado.
     * Consistência garantida: soma das bases = totalBase, soma dos valores =
     * totalComissao, tamanho = quantidadeLancamentos.
     */
    private List<ComissaoLancamentoResponse> lancamentos;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComissaoVendedorFechamento {
        private UUID vendedorId;
        private String vendedorNome;
        private Integer quantidadeLancamentos;
        private BigDecimal baseCalculo;
        private BigDecimal valorComissao;
    }
}
