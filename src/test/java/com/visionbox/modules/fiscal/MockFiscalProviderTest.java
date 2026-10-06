package com.visionbox.modules.fiscal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("MockFiscalProvider — contrato homologacao e contingencia")
class MockFiscalProviderTest {

    @Test
    @DisplayName("Emitir em tpEmis=9 deve autorizar mock mantendo contrato SEFAZ minimo")
    void contingenciaTpEmis9MantemContratoMinimo() {
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(500)
                .status(DocumentoFiscal.StatusFiscal.CONTINGENCIA)
                .ambiente("2")
                .tpEmis("9")
                .build();

        var resultado = new MockFiscalProvider().emitir(doc, "<NFe><tpEmis>9</tpEmis></NFe>");

        assertThat(resultado.autorizado()).isTrue();
        assertThat(resultado.codigoStatus()).isEqualTo("100");
        assertThat(resultado.chaveAcesso()).hasSize(44).containsOnlyDigits();
        assertThat(resultado.protocolo()).hasSize(15).containsOnlyDigits();
        assertThat(resultado.xmlRetorno()).contains("<cStat>100</cStat>");
        assertThat(doc.getTpEmis()).isEqualTo("9");
        assertThat(doc.getStatus()).isEqualTo(DocumentoFiscal.StatusFiscal.AUTORIZADO);
    }

    @Test
    @DisplayName("Cancelamento exige justificativa fiscal minima")
    void cancelamentoComJustificativaCurtaDeveRejeitar() {
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(10)
                .chaveAcesso("12345678901234567890123456789012345678901234")
                .status(DocumentoFiscal.StatusFiscal.AUTORIZADO)
                .ambiente("2")
                .tpEmis("1")
                .build();

        var resultado = new MockFiscalProvider().cancelar(doc, "curta");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("201");
        assertThat(resultado.motivo()).contains(">=15");
        assertThat(doc.getStatus()).isEqualTo(DocumentoFiscal.StatusFiscal.AUTORIZADO);
    }
}
