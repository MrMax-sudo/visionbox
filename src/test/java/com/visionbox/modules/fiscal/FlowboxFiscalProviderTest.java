package com.visionbox.modules.fiscal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class FlowboxFiscalProviderTest {

    private RestTemplate restTemplate;
    private FlowboxFiscalProvider provider;

    @BeforeEach
    void setUp() {
        restTemplate = Mockito.mock(RestTemplate.class);
        provider = new FlowboxFiscalProvider(restTemplate, "http://localhost:8085", "test-key");
    }

    @Test
    @DisplayName("Deve autorizar emissão quando Flowbox responder 200 OK com autorizado=true")
    void deveAutorizarEmissaoComFlowbox() {
        UUID lojaId = UUID.randomUUID();
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(lojaId)
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(100)
                .chaveAcesso("35260900000000000000650010000001001000000011")
                .build();

        Map<String, Object> respBody = Map.of(
                "autorizado", true,
                "protocolo", "135260000000001",
                "chaveAcesso", doc.getChaveAcesso(),
                "cStat", "100",
                "xMotivo", "Autorizado o uso da NFC-e"
        );

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(respBody, HttpStatus.OK));

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<xml>fake</xml>");

        assertThat(resultado.autorizado()).isTrue();
        assertThat(resultado.protocolo()).isEqualTo("135260000000001");
        assertThat(resultado.codigoStatus()).isEqualTo("100");
    }

    @Test
    @DisplayName("Deve tratar indisponibilidade do Flowbox com rejeição resiliente")
    void deveTratarIndisponibilidadeFlowbox() {
        UUID lojaId = UUID.randomUUID();
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(lojaId)
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(101)
                .chaveAcesso("35260900000000000000650010000001011000000012")
                .build();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<xml>fake</xml>");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("503");
        assertThat(resultado.motivo()).contains("Flowbox indisponível");
    }
}
