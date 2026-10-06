package com.visionbox.modules.fiscal;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Provider direto SEFAZ em modo contrato.
 * <p>
 * Ative apenas com profile {@code sefaz-direto}. Esta classe ainda nao executa SOAP,
 * assinatura A1 ou consulta real; ela valida pre-condicoes do contrato NF-e/NFC-e
 * 4.00 para permitir homologacao incremental sem substituir o MockFiscalProvider.
 */
@Slf4j
@Service
@Profile("sefaz-direto")
public class SefazDiretoProvider implements FiscalProvider {

    private static final Set<String> AMBIENTES_VALIDOS = Set.of("1", "2");
    private static final Set<String> TP_EMIS_VALIDOS = Set.of("1", "6", "7", "9");
    private static final Pattern CHAVE_ACESSO = Pattern.compile("\\d{44}");
    private static final Pattern SERIE = Pattern.compile("\\d{1,3}");

    @Override
    public ResultadoFiscal emitir(DocumentoFiscal documento, String xmlAssinado) {
        Optional<ResultadoFiscal> rejeicao = validarDocumento(documento)
                .or(() -> validarXmlAssinado(documento, xmlAssinado));

        if (rejeicao.isPresent()) {
            return rejeicao.get();
        }

        String chave = resolveChave(documento, xmlAssinado);
        log.warn("SefazDiretoProvider contrato validado, mas envio SOAP real ainda nao habilitado loja={} modelo={} serie={} numero={} tpEmis={}",
                documento.getLojaId(), documento.getModelo(), documento.getSerie(), documento.getNumero(), documento.getTpEmis());
        return ResultadoFiscal.rejeitado(chave, "998",
                "SefazDiretoProvider em modo contrato: envio SOAP NFeAutorizacao4 pendente de homologacao",
                null);
    }

    @Override
    public Optional<ResultadoFiscal> consultar(String chaveAcesso) {
        if (!chaveValida(chaveAcesso)) {
            return Optional.of(ResultadoFiscal.rejeitado(chaveAcesso, "000", "Chave de acesso deve conter 44 digitos", null));
        }
        return Optional.of(ResultadoFiscal.rejeitado(chaveAcesso, "998",
                "SefazDiretoProvider em modo contrato: consulta SOAP NFeConsultaProtocolo4 pendente de homologacao",
                null));
    }

    @Override
    public ResultadoFiscal cancelar(DocumentoFiscal documento, String justificativa) {
        Optional<ResultadoFiscal> rejeicao = validarDocumento(documento)
                .or(() -> validarJustificativa(justificativa));
        if (rejeicao.isPresent()) {
            return rejeicao.get();
        }
        return ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "998",
                "SefazDiretoProvider em modo contrato: evento de cancelamento pendente de homologacao",
                null);
    }

    @Override
    public ResultadoFiscal inutilizar(UUID lojaId, String serie, int numeroInicial, int numeroFinal, String justificativa) {
        if (lojaId == null) {
            return ResultadoFiscal.rejeitado(null, "000", "loja_id e obrigatorio para inutilizacao", null);
        }
        if (serie == null || !SERIE.matcher(serie).matches()) {
            return ResultadoFiscal.rejeitado(null, "000", "Serie deve conter de 1 a 3 digitos", null);
        }
        if (numeroInicial <= 0 || numeroFinal < numeroInicial) {
            return ResultadoFiscal.rejeitado(null, "000", "Faixa de inutilizacao invalida", null);
        }
        Optional<ResultadoFiscal> rejeicao = validarJustificativa(justificativa);
        if (rejeicao.isPresent()) {
            return rejeicao.get();
        }
        return new ResultadoFiscal(false, null, null, "998",
                "SefazDiretoProvider em modo contrato: inutilizacao pendente de homologacao",
                null, OffsetDateTime.now());
    }

    private Optional<ResultadoFiscal> validarDocumento(DocumentoFiscal documento) {
        if (documento == null) {
            return Optional.of(ResultadoFiscal.rejeitado(null, "000", "Documento fiscal e obrigatorio", null));
        }
        if (documento.getLojaId() == null) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "loja_id e obrigatorio", null));
        }
        if (documento.getModelo() == null) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Modelo fiscal e obrigatorio", null));
        }
        if (documento.getSerie() == null || !SERIE.matcher(documento.getSerie()).matches()) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Serie deve conter de 1 a 3 digitos", null));
        }
        if (documento.getNumero() == null || documento.getNumero() <= 0 || documento.getNumero() > 999_999_999) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Numero fiscal deve estar entre 1 e 999999999", null));
        }
        if (!AMBIENTES_VALIDOS.contains(documento.getAmbiente())) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Ambiente fiscal deve ser 1 ou 2", null));
        }
        if (!TP_EMIS_VALIDOS.contains(documento.getTpEmis())) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "tpEmis deve ser 1, 6, 7 ou 9", null));
        }
        if (documento.getChaveAcesso() != null && !chaveValida(documento.getChaveAcesso())) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Chave de acesso deve conter 44 digitos", null));
        }
        return Optional.empty();
    }

    private Optional<ResultadoFiscal> validarXmlAssinado(DocumentoFiscal documento, String xmlAssinado) {
        if (xmlAssinado == null || xmlAssinado.isBlank()) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "XML assinado e obrigatorio para SefazDiretoProvider", null));
        }

        Document xml;
        try {
            xml = parseXml(xmlAssinado);
        } catch (Exception e) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "XML fiscal malformado", null));
        }

        if (xml.getElementsByTagNameNS("*", "NFe").getLength() == 0 && xml.getElementsByTagName("NFe").getLength() == 0) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "XML deve conter elemento NFe", null));
        }
        if (xml.getElementsByTagNameNS("*", "Signature").getLength() == 0 && xml.getElementsByTagName("Signature").getLength() == 0) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "XML deve conter assinatura digital XMLDSig", null));
        }

        String versao = firstAttribute(xml, "infNFe", "versao");
        if (versao != null && !"4.00".equals(versao)) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Somente NF-e/NFC-e versao 4.00 e suportada", null));
        }

        String modeloXml = firstText(xml, "mod");
        if (modeloXml != null && !modeloXml.equals(modeloCodigo(documento.getModelo()))) {
            return Optional.of(ResultadoFiscal.rejeitado(documento.getChaveAcesso(), "000", "Modelo do XML diverge do documento fiscal", null));
        }

        return Optional.empty();
    }

    private Optional<ResultadoFiscal> validarJustificativa(String justificativa) {
        if (justificativa == null || justificativa.trim().length() < 15) {
            return Optional.of(ResultadoFiscal.rejeitado(null, "000", "Justificativa deve ter pelo menos 15 caracteres", null));
        }
        return Optional.empty();
    }

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
    }

    private String resolveChave(DocumentoFiscal documento, String xmlAssinado) {
        if (chaveValida(documento.getChaveAcesso())) {
            return documento.getChaveAcesso();
        }
        String chaveXml = extrairChave(xmlAssinado);
        return chaveValida(chaveXml) ? chaveXml : documento.getChaveAcesso();
    }

    private String extrairChave(String xml) {
        try {
            Document doc = parseXml(xml);
            String id = firstAttribute(doc, "infNFe", "Id");
            if (id != null && id.startsWith("NFe") && id.length() == 47) {
                return id.substring(3);
            }
            return firstText(doc, "chNFe");
        } catch (Exception e) {
            return null;
        }
    }

    private boolean chaveValida(String chave) {
        return chave != null && CHAVE_ACESSO.matcher(chave).matches();
    }

    private String modeloCodigo(DocumentoFiscal.ModeloFiscal modelo) {
        return modelo == DocumentoFiscal.ModeloFiscal.NFE_55 ? "55" : "65";
    }

    private String firstText(Document document, String tagName) {
        var nodes = document.getElementsByTagNameNS("*", tagName);
        if (nodes.getLength() == 0) {
            nodes = document.getElementsByTagName(tagName);
        }
        return nodes.getLength() == 0 ? null : nodes.item(0).getTextContent();
    }

    private String firstAttribute(Document document, String tagName, String attribute) {
        var nodes = document.getElementsByTagNameNS("*", tagName);
        if (nodes.getLength() == 0) {
            nodes = document.getElementsByTagName(tagName);
        }
        if (nodes.getLength() == 0 || !nodes.item(0).hasAttributes()) {
            return null;
        }
        var attr = nodes.item(0).getAttributes().getNamedItem(attribute);
        return attr == null ? null : attr.getNodeValue();
    }
}
