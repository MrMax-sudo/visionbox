package com.visionbox.modules.financeiro.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * OfxImportarResponse — resumo da importação/conciliação OFX.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OfxImportarResponse {

    /** Transações <STMTTRN> válidas encontradas no arquivo. */
    private int totalTransacoes;

    /** Linhas novas persistidas (exclui FITIDs duplicados). */
    private int importados;

    /** Linhas com FITID já importado para a loja (dedup — não gravadas). */
    private int duplicados;

    /** Linhas com match exato (valor + data dentro da tolerância). */
    private int conciliados;

    /** Linhas com candidato divergente (valor ou data fora da tolerância). */
    private int divergentes;

    /** Linhas sem correspondência em conta_receber/conta_pagar. */
    private int pendentes;

    /** Erros de parse por transação ignorada (ex.: TRNAMT inválido, sem DTPOSTED). */
    private List<String> erros;
}