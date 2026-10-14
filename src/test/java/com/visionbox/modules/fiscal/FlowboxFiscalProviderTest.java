package com.visionbox.modules.fiscal;

import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;
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
        cadastrarLojaFiscal("123456789110", "ABCDE12345", "1");
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
        cadastrarLojaFiscal("123456789110", "ABCDE12345", "1");
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

    @Test
    @DisplayName("Deve enviar só a referência do certificado A1 (certificadoId), nunca o PFX inline")
    void deveEnviarCertificadoIdNoPayload() {
        cadastrarLojaFiscal("123456789110", "ABCDE12345", "1");
        org.springframework.test.util.ReflectionTestUtils.setField(provider, "defaultCertificadoId", 5L);

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(102)
                .chaveAcesso("35260900000000000000650010000001021000000013")
                .build();

        Map<String, Object> respBody = Map.of("sucesso", true);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(respBody, HttpStatus.OK));

        provider.emitir(doc, "<xml>fake</xml>");

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        Mockito.verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(Map.class));

        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) captor.getValue().getBody();
        assertThat(payload).containsEntry("certificadoId", 5L);
        assertThat(payload).doesNotContainKey("certificado");
    }

    @Test
    @DisplayName("Deve recusar a emissão apontando o Painel Fiscal quando falta a Inscrição Estadual")
    void deveRecusarEmissaoSemInscricaoEstadual() {
        cadastrarLojaFiscal(null, "ABCDE12345", "1");

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(103)
                .chaveAcesso("35260900000000000000650010000001031000000014")
                .build();

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<xml>fake</xml>");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("999");
        assertThat(resultado.motivo()).contains("Inscrição Estadual").contains("cStat 209").contains("Módulo Fiscal");
        // Recusa antes de transmitir: não gasta um ciclo contra a SEFAZ para receber cStat 209.
        Mockito.verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("Deve recusar a NFC-e quando faltam CSC e CSC ID, que quebrariam o QR Code")
    void deveRecusarNfceSemCsc() {
        cadastrarLojaFiscal("11222333444", null, null);

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(104)
                .chaveAcesso("35260900000000000000650010000001041000000015")
                .build();

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<xml>fake</xml>");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.motivo()).contains("CSC").contains("QR Code");
        Mockito.verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("Deve enviar o cadastro fiscal da loja no payload, sem nenhum valor fixo")
    void deveEnviarCadastroFiscalDaLojaNoPayload() {
        cadastrarLojaFiscal("11222333444", "CSC-REAL-9", "7");

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(105)
                .chaveAcesso("35260900000000000000650010000001051000000016")
                .build();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(Map.of("sucesso", true), HttpStatus.OK));

        provider.emitir(doc, "<xml>fake</xml>");

        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        Mockito.verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(Map.class));

        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) captor.getValue().getBody();
        @SuppressWarnings("unchecked")
        Map<String, Object> emitente = (Map<String, Object>) payload.get("emitente");

        assertThat(emitente).containsEntry("inscricaoEstadual", "11222333444")
                .containsEntry("csc", "CSC-REAL-9")
                .containsEntry("cscId", "7")
                .containsEntry("crt", "1")
                .containsEntry("codigoMunicipio", "3550308")
                .containsEntry("telefone", "11958148028");
        assertThat(emitente).doesNotContainEntry("inscricaoEstadual", "123456789110");
        assertThat(payload).containsEntry("ambiente", "HOMOLOGACAO");
    }

    @Test
    @DisplayName("Deve recusar antes de transmitir quando a produção não tem email do emitente (infRespTec)")
    void deveRecusarProducaoSemEmailDoEmitente() {
        LojaRepository lojaRepository = Mockito.mock(LojaRepository.class);
        Loja loja = Loja.builder()
                .id(UUID.randomUUID())
                .nome("I LOVE MIMOS")
                .cnpj("40187613000102")
                .uf("SP")
                .inscricaoEstadual("151957359112")
                .csc("2d977230-481a-4b1c-8426-89fcb74cca73")
                .cscId("000001")
                .codigoMunicipio("3550308")
                .crt("1")
                .fiscalAmbiente("PRODUCAO")
                .endereco("Rua Vinte e Cinco de Março")
                .numero("641")
                .bairro("Centro")
                .cidade("São Paulo")
                .cep("01021900")
                .build();
        when(lojaRepository.findById(Mockito.any())).thenReturn(Optional.of(loja));
        org.springframework.test.util.ReflectionTestUtils.setField(provider, "lojaRepository", lojaRepository);

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("001")
                .numero(1)
                .chaveAcesso("35261040187613000102650010000000101000000010")
                .build();

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<xml>fake</xml>");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("999");
        assertThat(resultado.motivo()).contains("infRespTec");
        Mockito.verify(restTemplate, Mockito.never())
                .exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class));
    }

    @Test
    @DisplayName("Cancelamento envia emitente, ambiente, protocolo e certificado — o contrato do Flowbox")
    void deveEnviarPayloadCompletoDeCancelamento() {
        cadastrarLojaFiscal("11222333444", "CSC-REAL-9", "7");
        org.springframework.test.util.ReflectionTestUtils.setField(provider, "defaultCertificadoId", 1L);

        DocumentoFiscal doc = documentoComProtocolo("35261040187613000102650900000000061922243030", "13526007074917331");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(Map.of(
                        "sucesso", true,
                        "statusSefaz", "135",
                        "motivoSefaz", "Evento registrado e vinculado a NF-e",
                        "protocolo", "13526007074917999"), HttpStatus.OK));

        var resultado = provider.cancelar(doc, "Cliente desistiu da compra no PDV");

        @SuppressWarnings("unchecked")
        Map<String, Object> payload = capturarPayload();
        @SuppressWarnings("unchecked")
        Map<String, Object> emitente = (Map<String, Object>) payload.get("emitente");

        assertThat(payload)
                .containsEntry("ambiente", "HOMOLOGACAO")
                .containsEntry("chaveAcesso", doc.getChaveAcesso())
                .containsEntry("protocolo", "13526007074917331")
                .containsEntry("justificativa", "Cliente desistiu da compra no PDV")
                .containsEntry("certificadoId", 1L);
        assertThat(emitente)
                .containsEntry("cnpj", "40187613000102")
                .containsEntry("razaoSocial", "Otica Teste");

        assertThat(resultado.autorizado()).isTrue();
        assertThat(resultado.codigoStatus()).isEqualTo("135");
        assertThat(resultado.protocolo()).isEqualTo("13526007074917999");
        assertThat(resultado.motivo()).contains("Evento registrado");
    }

    @Test
    @DisplayName("Cancelamento rejeitado (HTTP 400 da SEFAZ) devolve o cStat real, não 'indisponível'")
    void devePropagarCstatRealDoCancelamentoRejeitado() {
        cadastrarLojaFiscal("11222333444", "CSC-REAL-9", "7");

        DocumentoFiscal doc = documentoComProtocolo("35261040187613000102650900000000021624523010", "13526007063048832");
        String corpo = "{\"sucesso\":false,\"statusSefaz\":\"501\","
                + "\"motivoSefaz\":\"Rejeição: Prazo de cancelamento superior ao previsto na Legislação\"}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new org.springframework.web.client.HttpClientErrorException(
                        HttpStatus.BAD_REQUEST, "Bad Request",
                        corpo.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        java.nio.charset.StandardCharsets.UTF_8));

        var resultado = provider.cancelar(doc, "Cliente desistiu da compra no PDV");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("501");
        assertThat(resultado.motivo()).contains("Prazo de cancelamento");
    }

    @Test
    @DisplayName("Rejeição da SEFAZ na emissão expõe o cStat real (539) em vez de 'Flowbox indisponível' 503")
    void deveExporCstatRealNaEmissaoRejeitada() {
        cadastrarLojaFiscal("11222333444", "CSC-REAL-9", "7");

        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("090")
                .numero(3)
                .chaveAcesso("35261040187613000102650900000000031769171006")
                .build();
        String corpo = "{\"sucesso\":false,\"statusSefaz\":\"539\","
                + "\"motivoSefaz\":\"Rejeição: Duplicidade de NF-e com diferença na Chave de Acesso\"}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new org.springframework.web.client.HttpClientErrorException(
                        HttpStatus.BAD_REQUEST, "Bad Request",
                        corpo.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        java.nio.charset.StandardCharsets.UTF_8));

        FiscalProvider.ResultadoFiscal resultado = provider.emitir(doc, "<xml>fake</xml>");

        assertThat(resultado.autorizado()).isFalse();
        assertThat(resultado.codigoStatus()).isEqualTo("539");
        assertThat(resultado.motivo()).contains("Duplicidade");
    }

    /** Captura o payload enviado no último POST para o Flowbox. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> capturarPayload() {
        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        Mockito.verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(Map.class));
        return (Map<String, Object>) captor.getValue().getBody();
    }

    private DocumentoFiscal documentoComProtocolo(String chave, String protocolo) {
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(UUID.randomUUID())
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("090")
                .numero(6)
                .chaveAcesso(chave)
                .protocolo(protocolo)
                .status(DocumentoFiscal.StatusFiscal.AUTORIZADO)
                .ambiente("1")
                .tpEmis("1")
                .build();
        return doc;
    }

    /** Registra a loja com o cadastro fiscal que o provedor lê antes de transmitir. */
    private void cadastrarLojaFiscal(String inscricaoEstadual, String csc, String cscId) {
        LojaRepository lojaRepository = Mockito.mock(LojaRepository.class);
        Loja loja = Loja.builder()
                .id(UUID.randomUUID())
                .nome("Otica Teste")
                .cnpj("40187613000102")
                .uf("SP")
                .inscricaoEstadual(inscricaoEstadual)
                .csc(csc)
                .cscId(cscId)
                .codigoMunicipio("3550308")
                .crt("1")
                .endereco("Rua Vinte e Cinco de Março")
                .numero("641")
                .bairro("Centro")
                .cidade("São Paulo")
                .cep("01021900")
                .emailContato("tamyres_galdino@hotmail.com")
                .telefone("11958148028")
                .build();
        when(lojaRepository.findById(Mockito.any())).thenReturn(Optional.of(loja));
        org.springframework.test.util.ReflectionTestUtils.setField(provider, "lojaRepository", lojaRepository);
    }
}
