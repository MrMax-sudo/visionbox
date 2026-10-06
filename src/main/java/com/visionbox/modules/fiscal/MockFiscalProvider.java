package com.visionbox.modules.fiscal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@Primary
@Profile({"dev", "test", "default"})
public class MockFiscalProvider implements FiscalProvider {

    private static final Logger log = LoggerFactory.getLogger(MockFiscalProvider.class);

    @Override
    public ResultadoFiscal emitir(DocumentoFiscal documento, String xmlAssinado) {
        log.info("[MOCK-FISCAL] emitir loja={} modelo={} serie={} numero={} tpEmis={} xmlBytes={}",
                documento.getLojaId(), documento.getModelo(), documento.getSerie(), documento.getNumero(),
                documento.getTpEmis(), xmlAssinado != null ? xmlAssinado.length() : 0);
        String protocolo = String.format("%015d", ThreadLocalRandom.current().nextLong(1_000_000_000_000_000L));
        String chave = documento.getChaveAcesso() != null ? documento.getChaveAcesso() : gerarChaveFake(documento);
        String xmlRet = "<retEnviNFe><protNFe><infProt><chNFe>" + chave + "</chNFe><nProt>" + protocolo + "</nProt><cStat>100</cStat></infProt></protNFe></retEnviNFe>";
        documento.setChaveAcesso(chave);
        documento.setProtocolo(protocolo);
        documento.setStatus(DocumentoFiscal.StatusFiscal.AUTORIZADO);
        documento.setXmlRetorno(xmlRet);
        documento.setDhAutorizacao(OffsetDateTime.now());
        documento.setCodigoStatus("100");
        return ResultadoFiscal.autorizado(chave, protocolo, xmlRet);
    }

    @Override
    public Optional<ResultadoFiscal> consultar(String chaveAcesso) {
        log.info("[MOCK-FISCAL] consultar chave={}", chaveAcesso);
        String protocolo = String.format("%015d", ThreadLocalRandom.current().nextLong(1_000_000_000_000_000L));
        String xml = "<retConsSitNFe><protNFe><infProt><chNFe>" + chaveAcesso + "</chNFe><nProt>" + protocolo + "</nProt><cStat>100</cStat></infProt></protNFe></retConsSitNFe>";
        return Optional.of(ResultadoFiscal.autorizado(chaveAcesso, protocolo, xml));
    }

    @Override
    public ResultadoFiscal cancelar(DocumentoFiscal documento, String justificativa) {
        log.info("[MOCK-FISCAL] cancelar chave={} just={}", documento.getChaveAcesso(), justificativa);
        if (justificativa == null || justificativa.length() < 15) {
            return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "201", "Justificativa deve ter >=15 chars", null);
        }
        String protocolo = String.format("%015d", ThreadLocalRandom.current().nextLong(1_000_000_000_000_000L));
        documento.setStatus(DocumentoFiscal.StatusFiscal.CANCELADO);
        String xml = "<retCancNFe><infCanc><chNFe>" + documento.getChaveAcesso() + "</chNFe><nProt>" + protocolo + "</nProt><cStat>135</cStat></infCanc></retCancNFe>";
        return new ResultadoFiscal(true, documento.getChaveAcesso(), protocolo, "135", "Evento registrado e vinculado a NF-e", xml, OffsetDateTime.now());
    }

    @Override
    public ResultadoFiscal inutilizar(UUID lojaId, String serie, int numeroInicial, int numeroFinal, String justificativa) {
        log.info("[MOCK-FISCAL] inutilizar loja={} serie={} faixa={}-{} just={}", lojaId, serie, numeroInicial, numeroFinal, justificativa);
        String protocolo = String.format("%015d", ThreadLocalRandom.current().nextLong(1_000_000_000_000_000L));
        String xml = "<retInutNFe><infInut><serie>" + serie + "</serie><nProt>" + protocolo + "</nProt><cStat>102</cStat></infInut></retInutNFe>";
        return new ResultadoFiscal(true, null, protocolo, "102", "Inutilização de número homologado", xml, OffsetDateTime.now());
    }

    private String gerarChaveFake(DocumentoFiscal doc) {
        StringBuilder sb = new StringBuilder(44);
        for (int i = 0; i < 44; i++) sb.append(ThreadLocalRandom.current().nextInt(10));
        return sb.toString();
    }
}
