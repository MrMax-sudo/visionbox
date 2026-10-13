package com.visionbox.modules.compras.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Testes do parser de XML NF-e de entrada (fixture em resources/fixtures/nfe-exemplo.xml).
 * Cobre: campos do cabeçalho, itens (EAN/NCM/qtd/custo), duplicatas, XML sem duplicata,
 * recusa de DOCTYPE (XXE) e falhas com mensagem útil.
 */
class NfeXmlParserTest {

    private final NfeXmlParser parser = new NfeXmlParser();

    static String fixture() throws IOException {
        try (InputStream in = NfeXmlParserTest.class.getResourceAsStream("/fixtures/nfe-exemplo.xml")) {
            assertThat(in).as("fixture /fixtures/nfe-exemplo.xml presente no classpath").isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void parse_xmlCompleto_extraiCabecalhoEmitenteEChave() throws IOException {
        NfeXmlParser.NfeDocumento doc = parser.parse(fixture());

        assertThat(doc.chaveAcesso()).hasSize(44).matches("\\d{44}");
        assertThat(doc.numero()).isEqualTo("0000123");
        assertThat(doc.serie()).isEqualTo("1");
        assertThat(doc.dataEmissao()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(doc.emitenteNome()).isEqualTo("LABORATORIO EXEMPLO LTDA");
        assertThat(doc.emitenteCnpj()).isEqualTo("12345678000195");
        assertThat(doc.valorTotal()).isEqualByComparingTo("1061.50");
        assertThat(doc.desconto()).isEqualByComparingTo("0.00");
        assertThat(doc.frete()).isEqualByComparingTo("0.00");
    }

    @Test
    void parse_xmlCompleto_extraiItensComEanNcmQtdECusto() throws IOException {
        NfeXmlParser.NfeDocumento doc = parser.parse(fixture());

        assertThat(doc.itens()).hasSize(2);

        NfeXmlParser.ItemNfe lente = doc.itens().get(0);
        assertThat(lente.codigoFornecedor()).isEqualTo("LEN-9001");
        assertThat(lente.ean()).isEqualTo("7891234567895");
        assertThat(lente.descricao()).isEqualTo("LENS OFTALMICA 1.60 ANTIRREFLEXO");
        assertThat(lente.ncm()).isEqualTo("90011010");
        assertThat(lente.unidade()).isEqualTo("UN");
        assertThat(lente.quantidade()).isEqualByComparingTo("10.000");
        assertThat(lente.custoUnitario()).isEqualByComparingTo("45.90");
        assertThat(lente.valorTotal()).isEqualByComparingTo("459.00");

        NfeXmlParser.ItemNfe armacao = doc.itens().get(1);
        assertThat(armacao.codigoFornecedor()).isEqualTo("ARM-7788");
        assertThat(armacao.ean()).as("cEAN=SEM GTIN vira null").isNull();
        assertThat(armacao.ncm()).isEqualTo("90041000");
        assertThat(armacao.quantidade()).isEqualByComparingTo("5.000");
        assertThat(armacao.custoUnitario()).isEqualByComparingTo("120.50");
    }

    @Test
    void parse_xmlCompleto_extraiDuplicatasComVencimentoEValor() throws IOException {
        NfeXmlParser.NfeDocumento doc = parser.parse(fixture());

        List<NfeXmlParser.DuplicataNfe> dups = doc.duplicatas();
        assertThat(dups).hasSize(2);
        assertThat(dups.get(0).numero()).isEqualTo("001");
        assertThat(dups.get(0).vencimento()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(dups.get(0).valor()).isEqualByComparingTo("530.75");
        assertThat(dups.get(1).numero()).isEqualTo("002");
        assertThat(dups.get(1).vencimento()).isEqualTo(LocalDate.of(2026, 12, 5));
        assertThat(dups.get(1).valor()).isEqualByComparingTo("530.75");
    }

    @Test
    void parse_xmlSemDuplicatas_retornaListaVazia() throws IOException {
        String semCobr = fixture().replaceAll("(?s)<cobr>.*?</cobr>", "");

        NfeXmlParser.NfeDocumento doc = parser.parse(semCobr);

        assertThat(doc.duplicatas()).isEmpty();
        assertThat(doc.itens()).hasSize(2);
    }

    @Test
    void parse_doctypeXxe_recusado() {
        String xxe = """
                <?xml version="1.0"?>
                <!DOCTYPE lolz [<!ENTITY lol SYSTEM "file:///etc/passwd">]>
                <nfeProc><NFe><infNFe Id="NFe35261012345678000195550010000001231123456785">
                </infNFe></NFe></nfeProc>
                """;
        assertThatThrownBy(() -> parser.parse(xxe))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("XML malformado");
    }

    @Test
    void parse_semInfNFe_lancaComMensagemUtil() {
        assertThatThrownBy(() -> parser.parse("<contribuinte><x>ok</x></contribuinte>"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("infNFe");
    }

    @Test
    void parse_xmlVazio_lancaIllegalArgument() {
        assertThatThrownBy(() -> parser.parse("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("XML vazio");
    }

    @Test
    void parse_chaveInvalida_lancaIllegalArgument() {
        String semChave = """
                <NFe><infNFe Id="NFe123"><ide><nNF>1</nNF><serie>1</serie>
                <dhEmi>2026-10-05T09:30:00-03:00</dhEmi></ide>
                <emit><xNome>X</xNome></emit>
                <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
                <det nItem="1"><prod><cProd>1</cProd><cEAN>SEM GTIN</cEAN><xProd>P</xProd>
                <NCM>90011010</NCM><uCom>UN</uCom><qCom>1.000</qCom><vUnCom>10.00</vUnCom>
                <vProd>10.00</vProd></prod></det>
                </infNFe></NFe>
                """;
        assertThatThrownBy(() -> parser.parse(semChave))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("chave de acesso");
    }

    @Test
    void parse_semDataEmissao_lancaIllegalArgument() throws IOException {
        String semData = fixture()
                .replaceAll("<dhEmi>.*?</dhEmi>", "")
                .replaceAll("<dEmi>.*?</dEmi>", "");
        assertThatThrownBy(() -> parser.parse(semData))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("data de emissão");
    }

    @Test
    void parse_semItens_lancaIllegalArgument() throws IOException {
        String semItens = fixture().replaceAll("(?s)<det nItem=\"1\">.*?</det>", "")
                .replaceAll("(?s)<det nItem=\"2\">.*?</det>", "");
        assertThatThrownBy(() -> parser.parse(semItens))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sem itens");
    }

    @Test
    void parse_quantidadeECusto_normalizadosParaScalesDoBanco() throws IOException {
        NfeXmlParser.NfeDocumento doc = parser.parse(fixture());
        NfeXmlParser.ItemNfe lente = doc.itens().get(0);
        assertThat(lente.quantidade().scale()).isEqualTo(3);
        assertThat(lente.custoUnitario().scale()).isEqualTo(2);
        assertThat(lente.custoUnitario()).isEqualTo(new BigDecimal("45.90"));
    }
}
