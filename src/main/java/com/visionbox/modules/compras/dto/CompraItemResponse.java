package com.visionbox.modules.compras.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompraItemResponse {
    private UUID id;
    private UUID produtoId;
    private String descricao;
    private String ncm;
    private String ean;
    private String codigoFornecedor;
    private String unidade;
    private BigDecimal quantidade;
    private BigDecimal custoUnitario;
    private BigDecimal valorTotal;
    /**
     * Origem do produtoId na importação (§3.4): TRUE = pré-cadastro automático
     * criado pelo de-para; FALSE = produto já existia no catálogo.
     * Preenchido APENAS na resposta da importação — leituras persistidas
     * (listar/buscar) vêm null porque a origem não é recalculável sem coluna
     * (o produto pré-cadastrado passa a existir no catálogo e o de-para casaria).
     */
    private Boolean preCadastrado;
}
