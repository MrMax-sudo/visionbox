package com.visionbox.modules.fiscal;

import java.util.Optional;
import java.util.UUID;

public interface FiscalProvider {

    ResultadoFiscal emitir(DocumentoFiscal documento, String xmlAssinado);

    Optional<ResultadoFiscal> consultar(String chaveAcesso);

    ResultadoFiscal cancelar(DocumentoFiscal documento, String justificativa);

    ResultadoFiscal inutilizar(UUID lojaId, String serie, int numeroInicial, int numeroFinal, String justificativa);

    record ResultadoFiscal(
            boolean autorizado,
            String chaveAcesso,
            String protocolo,
            String codigoStatus,
            String motivo,
            String xmlRetorno,
            java.time.OffsetDateTime dhAutorizacao
    ) {
        public static ResultadoFiscal autorizado(String chave, String protocolo, String xml) {
            return new ResultadoFiscal(true, chave, protocolo, "100", "Autorizado o uso da NF-e", xml, java.time.OffsetDateTime.now());
        }
        public static ResultadoFiscal rejeitado(String chave, String codigo, String motivo, String xml) {
            return new ResultadoFiscal(false, chave, null, codigo, motivo, xml, null);
        }
    }
}
