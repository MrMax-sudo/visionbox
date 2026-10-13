package com.visionbox.modules.financeiro.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * OfxImportarRequest — corpo JSON do POST /api/v1/financeiro/ofx/importar.
 * <p>
 * Alternativa suportada: enviar o OFX como corpo cru com Content-Type
 * text/plain | application/xml | text/xml | application/ofx | text/ofx e os
 * mesmos parâmetros em query string (toleranciaDias, conciliar).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OfxImportarRequest {

    /** Conteúdo OFX (SGML/XML até 3.x) em texto — elemento <STMTTRN> parseado. */
    @NotBlank(message = "conteudo é obrigatório (texto OFX)")
    @Size(max = 3_000_000, message = "conteudo excede o tamanho máximo de 3MB")
    private String conteudo;

    /** Tolerância em dias entre DTPOSTED e vencimento/data_pagamento p/ considerar conciliado. Default 3. */
    @Min(0)
    @Max(60)
    private Integer toleranciaDias;

    /** false = importa somente (tudo PENDENTE). Default true. */
    private Boolean conciliar;

    /**
     * Forma de pagamento usada na BAIXA das contas a receber conciliadas (D-017).
     * OFX não informa forma — se ausente, usa a forma PADRÃO da loja
     * (forma_pagamento.padrao); sem padrão cadastrado, baixa sem forma
     * (caixa trata como DINHEIRO — configurar um padrão evita o WARN).
     */
    private UUID formaPagamentoId;
}