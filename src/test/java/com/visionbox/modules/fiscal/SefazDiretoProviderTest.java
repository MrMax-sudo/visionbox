package com.visionbox.modules.fiscal;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SefazDiretoProviderTest {

    private final SefazDiretoProvider provider = new SefazDiretoProvider();

    @Test
    void deveRejeitarXmlSemAssinaturaDigital() {
        DocumentoFiscal doc = documentoValido();
        String xmlSemAssinatura = """
                <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
                  <infNFe versao="4.00" Id="NFe35190100000000000000650010000000011000000010">
                    <ide><mod>65</mod></ide>
                  </infNFe>
                </NFe>
                """;

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, xmlSemAssinatura);

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("000");
        assertThat(resultado.motivo()).contains("assinatura digital");
    }

    @Test
    void deveValidarContratoENaoEnviarSoapAntesDaHomologacao() {
        DocumentoFiscal doc = documentoValido();
        String xmlAssinado = """
                <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
                  <infNFe versao="4.00" Id="NFe35190100000000000000650010000000011000000010">
                    <ide><mod>65</mod></ide>
                  </infNFe>
                  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/>
                </NFe>
                """;

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, xmlAssinado);

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("998");
        assertThat(resultado.chaveAcesso()).isEqualTo("35190100000000000000650010000000011000000010");
        assertThat(resultado.motivo()).contains("modo contrato");
    }

    @Test
    void deveRejeitarTpEmisForaDoContratoAdr004() {
        DocumentoFiscal doc = documentoValido();
        doc.setTpEmis("2");

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<NFe/>");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("000");
        assertThat(resultado.motivo()).contains("tpEmis deve ser 1, 6, 7 ou 9");
    }

    @Test
    void deveRejeitarConsultaComChaveInvalida() {
        FiscalProvider.ResultadoFiscal resultado = provider.consultar("123").orElseThrow();

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("000");
        assertThat(resultado.motivo()).contains("44 digitos");
    }

    @Test
    void deveRejeitarCancelamentoComJustificativaCurta() {
        DocumentoFiscal doc = documentoValido();
        doc.setChaveAcesso("35190100000000000000650010000000011000000010");

        FiscalProvider.ResultadoFiscal resultado = provider.cancelar(doc, "curta");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("000");
        assertThat(resultado.motivo()).contains("15 caracteres");
    }

    private DocumentoFiscal documentoValido() {
        return DocumentoFiscal.builder()
                .lojaId(UUID.fromString("00000000-0000-0000-0000-000000000001"))
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(1)
                .ambiente("2")
                .tpEmis("1")
                .build();
    }
}
