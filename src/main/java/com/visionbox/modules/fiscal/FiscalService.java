package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.NfceEmitirRequest;
import com.visionbox.modules.fiscal.dto.NfceEmitirResponse;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class FiscalService {

    private final FiscalProvider fiscalProvider;
    private final DocumentoFiscalRepository repository;

    @Transactional
    public NfceEmitirResponse emitirNfce(NfceEmitirRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        String serie = req.getSerie() != null && !req.getSerie().isBlank() ? req.getSerie().trim() : "1";
        // normaliza para 3 dígitos se numérico curto
        if (serie.matches("\\d+") && serie.length() < 3) {
            serie = String.format("%03d", Integer.parseInt(serie));
            // mantém 1 -> 001 compatível com SEFAZ, mas aceita "1" também
            // para teste manter sem zero à esquerda se req veio "1" ??? Keep 1-char fallback handled above -> now 001
            // If original was "1", we produce "001" which matches DocumentoFiscal serie length 3
        }
        Integer numero = req.getNumero();
        if (numero == null) {
            // gera aleatório 1..999999 para MVP; prod usa sequencia_fiscal(loja_id, modelo, serie)
            numero = ThreadLocalRandom.current().nextInt(1, 999999);
            // garante unicidade tentativa
            int tent = 0;
            String serieFinal = serie;
            while (tent < 3) {
                DocumentoFiscal.ModeloFiscal modTry = parseModelo(req.getModelo());
                if (repository.findByLojaIdAndModeloAndSerieAndNumero(lojaId, modTry, serieFinal, numero).isEmpty()) break;
                numero = ThreadLocalRandom.current().nextInt(1, 999999);
                tent++;
            }
        }
        DocumentoFiscal.ModeloFiscal modelo = parseModelo(req.getModelo());
        String ambiente = req.getAmbiente() != null ? req.getAmbiente() : "2";
        String tpEmis = "1"; // normal

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(lojaId)
                .modelo(modelo)
                .serie(serie)
                .numero(numero)
                .chaveAcesso(req.getChaveAcesso())
                .status(DocumentoFiscal.StatusFiscal.PENDENTE)
                .ambiente(ambiente)
                .tpEmis(tpEmis)
                .pedidoId(req.getPedidoId())
                .ordemServicoId(req.getOrdemServicoId())
                .dhEmissao(OffsetDateTime.now())
                .build();
        // prePersist will set dhEmissao if null
        doc = repository.save(doc);

        String xmlAssinado = req.getXmlAssinado() != null ? req.getXmlAssinado() : "<NFe><infNFe versao=\"4.00\"><ide><serie>" + serie + "</serie><nNF>" + numero + "</nNF></ide></infNFe></NFe>";

        FiscalProvider.ResultadoFiscal resultado = fiscalProvider.emitir(doc, xmlAssinado);

        // Persistir retorno do provider de forma generica; o mock tambem pode mutar doc.
        doc.setXmlEnviado(xmlAssinado);
        if (resultado.chaveAcesso() != null) doc.setChaveAcesso(resultado.chaveAcesso());
        if (resultado.protocolo() != null) doc.setProtocolo(resultado.protocolo());
        if (resultado.xmlRetorno() != null) doc.setXmlRetorno(resultado.xmlRetorno());
        if (resultado.dhAutorizacao() != null) doc.setDhAutorizacao(resultado.dhAutorizacao());
        if (resultado.autorizado()) {
            doc.setStatus(DocumentoFiscal.StatusFiscal.AUTORIZADO);
            doc.setCodigoStatus(resultado.codigoStatus());
            doc.setMotivo(resultado.motivo());
        } else {
            doc.setStatus(DocumentoFiscal.StatusFiscal.REJEITADO);
            doc.setCodigoStatus(resultado.codigoStatus());
            doc.setMotivo(resultado.motivo());
        }
        doc = repository.save(doc);

        log.info("NFC-e emitida loja={} modelo={} serie={} numero={} chave={} protocolo={} status={}",
                lojaId, modelo, serie, numero, resultado.chaveAcesso(), resultado.protocolo(), doc.getStatus());

        return NfceEmitirResponse.builder()
                .id(doc.getId())
                .lojaId(lojaId)
                .modelo(doc.getModelo().name())
                .serie(doc.getSerie())
                .numero(doc.getNumero())
                .chaveAcesso(resultado.chaveAcesso())
                .protocolo(resultado.protocolo())
                .status(doc.getStatus().name())
                .codigoStatus(resultado.codigoStatus())
                .motivo(resultado.motivo())
                .xmlRetorno(resultado.xmlRetorno())
                .dhAutorizacao(resultado.dhAutorizacao())
                .dhEmissao(doc.getDhEmissao())
                .ambiente(doc.getAmbiente())
                .tpEmis(doc.getTpEmis())
                .autorizado(resultado.autorizado())
                .build();
    }

    private DocumentoFiscal.ModeloFiscal parseModelo(String m) {
        if (m == null || m.isBlank()) return DocumentoFiscal.ModeloFiscal.NFCE_65;
        String s = m.trim().toUpperCase();
        if (s.contains("55") || s.equals("NFE")) return DocumentoFiscal.ModeloFiscal.NFE_55;
        return DocumentoFiscal.ModeloFiscal.NFCE_65;
    }
}
