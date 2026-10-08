package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.service.OfxParser.Resultado;
import com.visionbox.modules.financeiro.service.OfxParser.Transacao;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testes unitários do parser OFX (US13): estilos SGML/XML, DTPOSTED com
 * horário/timezone, TRNAMT pt-BR (vírgula), FITID ausente (auto gerado),
 * transações inválidas ignoradas com erro reportado.
 */
class OfxParserTest {

    @Test
    void parse_xmlCompleto_extraiCamposDoStmtTrn() {
        String ofx = """
                <?xml version="1.0"?>
                <OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
                <STMTTRN>
                  <TRNTYPE>CREDIT</TRNTYPE>
                  <DTPOSTED>20261005103000[-3:GMT]</DTPOSTED>
                  <TRNAMT>150.25</TRNAMT>
                  <FITID>0001</FITID>
                  <MEMO>Transferencia recebida</MEMO>
                </STMTTRN>
                </BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
                """;

        Resultado r = OfxParser.parse(ofx);

        assertThat(r.erros()).isEmpty();
        assertThat(r.transacoes()).hasSize(1);
        Transacao t = r.transacoes().get(0);
        assertThat(t.trnTipo()).isEqualTo("CREDIT");
        assertThat(t.dataPostamento()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(t.valor()).isEqualByComparingTo("150.25");
        assertThat(t.fitId()).isEqualTo("0001");
        assertThat(t.memo()).isEqualTo("Transferencia recebida");
    }

    @Test
    void parse_sgmlSemFechamento_devoResolverTags() {
        String ofx = """
                OFXHEADER:100
                DATA:OFXSGML
                <OFX><BANKTRANLIST>
                <STMTTRN>
                <TRNTYPE>DEBIT>
                <DTPOSTED>20261001>
                <TRNAMT>-89.90>
                <FITID>ABC-123>
                <MEMO>Saque>
                </STMTTRN>
                </BANKTRANLIST></OFX>
                """;

        Resultado r = OfxParser.parse(ofx);

        assertThat(r.transacoes()).hasSize(1);
        Transacao t = r.transacoes().get(0);
        assertThat(t.trnTipo()).isEqualTo("DEBIT");
        assertThat(t.dataPostamento()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(t.valor()).isEqualByComparingTo("-89.90");
        assertThat(t.fitId()).isEqualTo("ABC-123");
    }

    @Test
    void parse_dtPostedComTimeENumeroDeDias_extraiData() {
        Resultado r = OfxParser.parse("""
                <STMTTRN><TRNTYPE>CREDIT</TRNTYPE>
                <DTPOSTED>20261001120000[-5:GMT]</DTPOSTED>
                <TRNAMT>10.00</TRNAMT><FITID>X1</FITID></STMTTRN>
                """);
        assertThat(r.transacoes()).hasSize(1);
        assertThat(r.transacoes().get(0).dataPostamento()).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void parse_trnamtComVirgula_interpretaDecimalBrasileiro() {
        Resultado r = OfxParser.parse("""
                <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261001</DTPOSTED>
                <TRNAMT>1234,56</TRNAMT><FITID>BR1</FITID></STMTTRN>
                """);
        assertThat(r.transacoes()).hasSize(1);
        assertThat(r.transacoes().get(0).valor()).isEqualByComparingTo("1234.56");
    }

    @Test
    void parse_trnamtComMilharEDecimal_converte() {
        Resultado r = OfxParser.parse("""
                <STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261001</DTPOSTED>
                <TRNAMT>1.234,56</TRNAMT><FITID>BR2</FITID></STMTTRN>
                """);
        assertThat(r.transacoes()).hasSize(1);
        assertThat(r.transacoes().get(0).valor()).isEqualByComparingTo("1234.56");
    }

    @Test
    void parse_semFitId_geraFitIdAutoDeterministico() {
        String ofx = """
                <STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261001</DTPOSTED>
                <TRNAMT>55.00</TRNAMT><MEMO>Venda</MEMO></STMTTRN>
                """;
        Resultado a = OfxParser.parse(ofx);
        Resultado b = OfxParser.parse(ofx);

        assertThat(a.transacoes()).hasSize(1);
        assertThat(a.transacoes().get(0).fitId()).startsWith("AUTO-");
        // Mesmo conteúdo -> mesmo FITID (dedup estável em reimportação)
        assertThat(a.transacoes().get(0).fitId()).isEqualTo(b.transacoes().get(0).fitId());
    }

    @Test
    void parse_transacaoSemTrnAmt_ignoradaComErro() {
        Resultado r = OfxParser.parse("""
                <STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261001</DTPOSTED>
                <FITID>SEM-VALOR</FITID></STMTTRN>
                """);
        assertThat(r.transacoes()).isEmpty();
        assertThat(r.erros()).isNotEmpty();
        assertThat(r.erros().get(0)).contains("Transação #1");
    }

    @Test
    void parse_transacaoSemDtPosted_ignoradaComErro() {
        Resultado r = OfxParser.parse("""
                <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><TRNAMT>-1.00</TRNAMT>
                <FITID>SEM-DATA</FITID></STMTTRN>
                """);
        assertThat(r.transacoes()).isEmpty();
        assertThat(r.erros()).hasSize(1);
    }

    @Test
    void parse_misturaValidaEInvalida_importaValidasEReportaErros() {
        Resultado r = OfxParser.parse("""
                <STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261001</DTPOSTED>
                <TRNAMT>100.00</TRNAMT><FITID>OK1</FITID></STMTTRN>
                <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>NAO-DATA</DTPOSTED>
                <TRNAMT>-1.00</TRNAMT><FITID>BAD1</FITID></STMTTRN>
                """);
        assertThat(r.transacoes()).hasSize(1);
        assertThat(r.erros()).hasSize(1);
        assertThat(r.transacoes().get(0).fitId()).isEqualTo("OK1");
    }

    @Test
    void parse_semStmtTrn_retornaSemTransacoesSemErroFatal() {
        Resultado r = OfxParser.parse("<OFX><BANKTRANLIST></BANKTRANLIST></OFX>");
        assertThat(r.transacoes()).isEmpty();
    }

    @Test
    void parse_conteudoVazio_retornaVazioComErro() {
        Resultado r = OfxParser.parse("   ");
        assertThat(r.transacoes()).isEmpty();
        assertThat(r.erros()).containsExactly("Conteúdo OFX vazio");
    }

    @Test
    void parse_tagsCaseInsensitive_resolveTagsMinusculas() {
        Resultado r = OfxParser.parse("""
                <stmttrn><trntype>CREDIT</trntype><dtposted>20261001</dtposted>
                <trnamt>9.99</trnamt><fitid>LOWCASE</fitid></stmttrn>
                """);
        assertThat(r.transacoes()).hasSize(1);
        assertThat(r.transacoes().get(0).valor()).isEqualByComparingTo("9.99");
    }
}