package com.visionbox.modules.compras.service;

import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Parser do XML de NF-e de ENTRADA (§3.4 — Compras por XML).
 * <p>
 * Só consome XML de fornecedor; emissão é do Flowbox (R3 — não toca fiscal provider).
 * Usa o parser DOM nativo do JDK (sem dependência nova no pom).
 * <p>
 * Segurança (sinalizado ao security-auditor): DTD e entidades externas desabilitadas
 * (proteção XXE — qualquer {@code <!DOCTYPE>} é recusado).
 */
@Component
public class NfeXmlParser {

    /** Cabeçalho de uma NF-e de entrada já interpretada. */
    public record NfeDocumento(
            String chaveAcesso,
            String numero,
            String serie,
            LocalDate dataEmissao,
            String emitenteNome,
            String emitenteCnpj,
            BigDecimal valorTotal,
            BigDecimal desconto,
            BigDecimal frete,
            List<ItemNfe> itens,
            List<DuplicataNfe> duplicatas) {
    }

    /** Item do XML: descrição, NCM, EAN, quantidade e custo unitário. */
    public record ItemNfe(
            String codigoFornecedor,
            String ean,
            String descricao,
            String ncm,
            String unidade,
            BigDecimal quantidade,
            BigDecimal custoUnitario,
            BigDecimal valorTotal) {
    }

    /** Duplicata/fatura da nota (cobr/dup). */
    public record DuplicataNfe(String numero, LocalDate vencimento, BigDecimal valor) {
    }

    /**
     * Interpretado o XML da NF-e.
     *
     * @throws IllegalArgumentException XML malformado, sem infNFe, sem campos obrigatórios ou com DOCTYPE (XXE)
     */
    public NfeDocumento parse(String xml) {
        if (xml == null || xml.isBlank()) {
            throw new IllegalArgumentException("XML vazio");
        }
        Document doc = newDocument(xml);

        NodeList raizes = doc.getElementsByTagName("infNFe");
        if (raizes.getLength() == 0) {
            throw new IllegalArgumentException("XML não contém NF-e válida (elemento infNFe ausente)");
        }
        Element infNFe = (Element) raizes.item(0);

        String chave = normalizarChave(infNFe.getAttribute("Id"));
        if (chave == null) {
            throw new IllegalArgumentException("NF-e sem chave de acesso (44 dígitos) no atributo Id de infNFe");
        }

        Element ide = filho(infNFe, "ide");
        String numero = texto(ide, "nNF");
        if (numero == null || numero.isBlank()) {
            throw new IllegalArgumentException("NF-e sem número (ide/nNF)");
        }
        String serie = texto(ide, "serie");
        LocalDate dataEmissao = parseDataEmissao(texto(ide, "dhEmi"), texto(ide, "dEmi"));
        if (dataEmissao == null) {
            throw new IllegalArgumentException("NF-e sem data de emissão (ide/dhEmi ou ide/dEmi)");
        }

        Element emit = filho(infNFe, "emit");
        String emitenteNome = texto(emit, "xNome");
        if (emitenteNome == null || emitenteNome.isBlank()) {
            throw new IllegalArgumentException("NF-e sem razão social do emitente (emit/xNome)");
        }
        String emitenteCnpj = soDigitos(texto(emit, "CNPJ"));

        Element icmsTot = filhoPorCaminho(infNFe, "total", "ICMSTot");
        BigDecimal valorTotal = decimal(texto(icmsTot, "vNF"));
        if (valorTotal == null) {
            throw new IllegalArgumentException("NF-e sem valor total (total/ICMSTot/vNF)");
        }
        BigDecimal desconto = decimalOrZero(texto(icmsTot, "vDesc"));
        BigDecimal frete = decimalOrZero(texto(icmsTot, "vFrete"));

        List<ItemNfe> itens = new ArrayList<>();
        NodeList dets = doc.getElementsByTagName("det");
        for (int i = 0; i < dets.getLength(); i++) {
            Element det = (Element) dets.item(i);
            Element prod = filho(det, "prod");
            if (prod == null) continue;
            String descricao = texto(prod, "xProd");
            // NF-e 4.00 usa vUnCom; fallback vUn para layouts atípicos.
            BigDecimal quantidade = decimal(texto(prod, "qCom"));
            BigDecimal custo = decimal(texto(prod, "vUnCom"));
            if (custo == null) custo = decimal(texto(prod, "vUn"));
            BigDecimal vProd = decimal(texto(prod, "vProd"));
            if (descricao == null || descricao.isBlank() || quantidade == null || custo == null) {
                continue; // item incompleto — não derruba a importação da nota inteira
            }
            if (quantidade.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            itens.add(new ItemNfe(
                    limpar(texto(prod, "cProd")),
                    normalizarEan(texto(prod, "cEAN")),
                    descricao.trim(),
                    soDigitos(texto(prod, "NCM")),
                    limpar(texto(prod, "uCom")),
                    quantidade.setScale(3, RoundingMode.HALF_EVEN),
                    custo.setScale(2, RoundingMode.HALF_EVEN),
                    vProd != null ? vProd.setScale(2, RoundingMode.HALF_EVEN) : null));
        }
        if (itens.isEmpty()) {
            throw new IllegalArgumentException("NF-e sem itens válidos (det/prod)");
        }

        List<DuplicataNfe> duplicatas = new ArrayList<>();
        NodeList dups = doc.getElementsByTagName("dup");
        for (int i = 0; i < dups.getLength(); i++) {
            Element dup = (Element) dups.item(i);
            String numeroDup = texto(dup, "nDup");
            LocalDate venc = parseDataSimples(texto(dup, "dVenc"));
            BigDecimal valorDup = decimal(texto(dup, "vDup"));
            if (numeroDup == null || venc == null || valorDup == null
                    || valorDup.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            duplicatas.add(new DuplicataNfe(numeroDup.trim(), venc, valorDup.setScale(2, RoundingMode.HALF_EVEN)));
        }

        return new NfeDocumento(chave, numero.trim(), serie != null ? serie.trim() : null,
                dataEmissao, emitenteNome.trim(), emitenteCnpj,
                valorTotal.setScale(2, RoundingMode.HALF_EVEN), desconto, frete,
                List.copyOf(itens), List.copyOf(duplicatas));
    }

    // ------------------------------------------------------------------
    // Internos
    // ------------------------------------------------------------------

    private Document newDocument(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // Hardening XXE: sem DTD, sem entidades externas, sem XInclude.
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            return factory.newDocumentBuilder()
                    .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("XML malformado ou não suportado: " + e.getMessage(), e);
        }
    }

    /** {@code Id="NFe + 44 dígitos"} → só os 44 dígitos; nulo se não for chave válida. */
    private String normalizarChave(String idAttr) {
        if (idAttr == null) return null;
        String digits = soDigitos(idAttr);
        return digits.length() == 44 ? digits : null;
    }

    private LocalDate parseDataEmissao(String dhEmi, String dEmi) {
        if (dhEmi != null && !dhEmi.isBlank()) {
            String t = dhEmi.trim();
            try {
                return OffsetDateTime.parse(t).toLocalDate();
            } catch (RuntimeException e) {
                try {
                    return java.time.LocalDateTime.parse(t).toLocalDate();
                } catch (RuntimeException e2) {
                    // cai para dEmi (fallback) ou erro abaixo
                }
            }
        }
        return parseDataSimples(dEmi);
    }

    private LocalDate parseDataSimples(String data) {
        if (data == null || data.isBlank()) return null;
        try {
            return LocalDate.parse(data.trim());
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** {@code cEAN="SEM GTIN" | "0" | ""} → null (sem código de barras utilizável). */
    private String normalizarEan(String ean) {
        String limpo = limpar(ean);
        if (limpo == null || limpo.isBlank()) return null;
        if (limpo.equalsIgnoreCase("SEM GTIN")) return null;
        String digits = soDigitos(limpo);
        if (digits.isEmpty() || digits.length() < 8 || digits.replace("0", "").isEmpty()) return null;
        return digits;
    }

    private Element filho(Element pai, String tag) {
        if (pai == null) return null;
        NodeList filhos = pai.getChildNodes();
        for (int i = 0; i < filhos.getLength(); i++) {
            Node n = filhos.item(i);
            if (n.getNodeType() == Node.ELEMENT_NODE && n.getNodeName().equals(tag)) {
                return (Element) n;
            }
        }
        return null;
    }

    private Element filhoPorCaminho(Element raiz, String... tags) {
        Element atual = raiz;
        for (String tag : tags) {
            if (atual == null) return null;
            atual = filho(atual, tag);
        }
        return atual;
    }

    private String texto(Element pai, String tag) {
        Element el = filho(pai, tag);
        if (el == null) return null;
        String t = el.getTextContent();
        return t != null ? t.trim() : null;
    }

    private BigDecimal decimal(String v) {
        if (v == null || v.isBlank()) return null;
        try {
            return new BigDecimal(v.trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal decimalOrZero(String v) {
        BigDecimal d = decimal(v);
        return d != null ? d : BigDecimal.ZERO;
    }

    private String soDigitos(String v) {
        return v == null ? null : v.replaceAll("\\D", "");
    }

    private String limpar(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }
}
