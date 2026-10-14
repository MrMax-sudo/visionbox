package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.NfceCancelarRequest;
import com.visionbox.modules.fiscal.dto.NfceEmitirRequest;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("FiscalService — mock fiscal e contrato de contingencia M2")
class FiscalServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final String CHAVE_44 = "12345678901234567890123456789012345678901234";
    private static final String PROTOCOLO_15 = "123456789012345";

    private FiscalProvider provider;
    private DocumentoFiscalRepository repository;
    private com.visionbox.modules.pessoa.repository.LojaRepository lojaRepository;
    private FiscalService service;

    @BeforeEach
    void setUp() {
        provider = mock(FiscalProvider.class);
        repository = mock(DocumentoFiscalRepository.class);
        lojaRepository = mock(com.visionbox.modules.pessoa.repository.LojaRepository.class);
        service = new FiscalService(provider, repository, lojaRepository);

        TenantContext.setCurrentLojaId(LOJA_ID);
        // Loja sem configuração fiscal (V48): série "001", ambiente "2", número pelo máximo da série.
        when(lojaRepository.findById(LOJA_ID)).thenReturn(Optional.empty());
        when(repository.maiorNumeroDaSerie(any(), any(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(repository.findByLojaIdAndModeloAndSerieAndNumero(any(), any(), anyString(), any()))
                .thenReturn(Optional.empty());
        when(repository.save(any(DocumentoFiscal.class))).thenAnswer(invocation -> {
            DocumentoFiscal doc = invocation.getArgument(0);
            if (doc.getId() == null) {
                doc.setId(UUID.randomUUID());
            }
            return doc;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("NFC-e autorizada normaliza serie, preserva loja_id e retorna contrato cStat 100")
    void deveEmitirNfceAutorizadaComContratoMock() {
        when(provider.emitir(any(DocumentoFiscal.class), anyString(), any(NfceEmitirRequest.class)))
                .thenReturn(FiscalProvider.ResultadoFiscal.autorizado(CHAVE_44, PROTOCOLO_15, "<ret cStat=\"100\"/>"));

        var response = service.emitirNfce(NfceEmitirRequest.builder()
                .modelo("NFCE_65")
                .serie("1")
                .numero(77)
                .xmlAssinado("<NFe/>")
                .build());

        assertThat(response.getLojaId()).isEqualTo(LOJA_ID);
        assertThat(response.getModelo()).isEqualTo("NFCE_65");
        assertThat(response.getSerie()).isEqualTo("001");
        assertThat(response.getNumero()).isEqualTo(77);
        assertThat(response.getChaveAcesso()).isEqualTo(CHAVE_44);
        assertThat(response.getProtocolo()).isEqualTo(PROTOCOLO_15);
        assertThat(response.getCodigoStatus()).isEqualTo("100");
        assertThat(response.getStatus()).isEqualTo("AUTORIZADO");
        assertThat(response.getAmbiente()).isEqualTo("2");
        assertThat(response.getTpEmis()).isEqualTo("1");

        ArgumentCaptor<DocumentoFiscal> docCaptor = ArgumentCaptor.forClass(DocumentoFiscal.class);
        verify(provider).emitir(docCaptor.capture(), anyString(), any(NfceEmitirRequest.class));
        DocumentoFiscal enviadoAoProvider = docCaptor.getValue();
        assertThat(enviadoAoProvider.getLojaId()).isEqualTo(LOJA_ID);
        assertThat(enviadoAoProvider.getModelo()).isEqualTo(DocumentoFiscal.ModeloFiscal.NFCE_65);
        assertThat(enviadoAoProvider.getStatus()).isEqualTo(DocumentoFiscal.StatusFiscal.AUTORIZADO);
    }

    @Test
    @DisplayName("NFE_55 rejeitada deve persistir status REJEITADO sem autorizar indevidamente")
    void devePropagarRejeicaoDoProvider() {
        when(provider.emitir(any(DocumentoFiscal.class), anyString(), any(NfceEmitirRequest.class)))
                .thenReturn(FiscalProvider.ResultadoFiscal.rejeitado(CHAVE_44, "539", "Duplicidade de NF-e", "<ret cStat=\"539\"/>"));

        var response = service.emitirNfce(NfceEmitirRequest.builder()
                .modelo("NFE")
                .serie("009")
                .numero(101)
                .ambiente("2")
                .build());

        assertThat(response.isAutorizado()).isFalse();
        assertThat(response.getModelo()).isEqualTo("NFE_55");
        assertThat(response.getStatus()).isEqualTo("REJEITADO");
        assertThat(response.getCodigoStatus()).isEqualTo("539");
        assertThat(response.getMotivo()).contains("Duplicidade");
    }

    @Test
    @DisplayName("Sem TenantContext deve falhar fechado antes de salvar documento fiscal")
    void semTenantContextDeveFalharFechado() {
        TenantContext.clear();

        assertThatThrownBy(() -> service.emitirNfce(NfceEmitirRequest.builder().build()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("Sem número informado usa o maior número já usado na série + 1 (V48)")
    void deveContinuarASequenciaDaSerie() {
        when(repository.maiorNumeroDaSerie(any(), any(), anyString(), anyString()))
                .thenReturn(Optional.of(126));
        when(provider.emitir(any(DocumentoFiscal.class), anyString(), any(NfceEmitirRequest.class)))
                .thenReturn(FiscalProvider.ResultadoFiscal.autorizado(CHAVE_44, PROTOCOLO_15, "<ret cStat=\"100\"/>"));

        var response = service.emitirNfce(NfceEmitirRequest.builder()
                .modelo("NFCE_65")
                .xmlAssinado("<NFe/>")
                .build());

        assertThat(response.getNumero()).isEqualTo(127);
    }

    @Test
    @DisplayName("Série vazia cai para o número inicial configurado na loja, não para um aleatório")
    void deveUsarNumeroInicialDaLojaQuandoSerieVazia() {
        com.visionbox.modules.pessoa.domain.Loja loja = com.visionbox.modules.pessoa.domain.Loja.builder()
                .id(LOJA_ID)
                .fiscalSerieNfce("004")
                .fiscalSerieNfe("026")
                .fiscalNumeroInicialNfce(127)
                .fiscalNumeroInicialNfe(34)
                .fiscalAmbiente("PRODUCAO")
                .build();
        when(lojaRepository.findById(LOJA_ID)).thenReturn(Optional.of(loja));
        when(provider.emitir(any(DocumentoFiscal.class), anyString(), any(NfceEmitirRequest.class)))
                .thenReturn(FiscalProvider.ResultadoFiscal.autorizado(CHAVE_44, PROTOCOLO_15, "<ret cStat=\"100\"/>"));

        var nfce = service.emitirNfce(NfceEmitirRequest.builder().modelo("NFCE_65").xmlAssinado("<NFe/>").build());
        var nfe = service.emitirNfce(NfceEmitirRequest.builder().modelo("NFE_55").xmlAssinado("<NFe/>").build());

        assertThat(nfce.getSerie()).isEqualTo("004");
        assertThat(nfce.getNumero()).isEqualTo(127);
        assertThat(nfce.getAmbiente()).isEqualTo("1");
        assertThat(nfe.getSerie()).isEqualTo("026");
        assertThat(nfe.getNumero()).isEqualTo(34);
    }

    @Test
    @DisplayName("Série configurada na loja prevalece sobre a série da requisição")
    void deveUsarSerieDaLoja() {
        com.visionbox.modules.pessoa.domain.Loja loja = com.visionbox.modules.pessoa.domain.Loja.builder()
                .id(LOJA_ID)
                .fiscalSerieNfce("7")
                .build();
        when(lojaRepository.findById(LOJA_ID)).thenReturn(Optional.of(loja));
        when(provider.emitir(any(DocumentoFiscal.class), anyString(), any(NfceEmitirRequest.class)))
                .thenReturn(FiscalProvider.ResultadoFiscal.autorizado(CHAVE_44, PROTOCOLO_15, "<ret cStat=\"100\"/>"));

        var response = service.emitirNfce(NfceEmitirRequest.builder()
                .modelo("NFCE_65")
                .serie("9")
                .numero(5)
                .xmlAssinado("<NFe/>")
                .build());

        assertThat(response.getSerie()).isEqualTo("007");
        assertThat(response.getNumero()).isEqualTo(5);
    }

    @Test
    @DisplayName("Cancelamento de documento AUTORIZADO grava CANCELADO com cStat 135")
    void deveCancelarDocumentoAutorizado() {
        DocumentoFiscal doc = documentoAutorizado();
        when(repository.findByChaveAcessoAndLojaId(CHAVE_44, LOJA_ID)).thenReturn(Optional.of(doc));
        when(provider.cancelar(any(DocumentoFiscal.class), anyString()))
                .thenReturn(new FiscalProvider.ResultadoFiscal(true, CHAVE_44, "135260000000002", "135",
                        "Evento registrado e vinculado a NF-e", null, java.time.OffsetDateTime.now()));

        var resp = service.cancelarNfce(NfceCancelarRequest.builder()
                .chaveAcesso(CHAVE_44)
                .justificativa("Cliente desistiu da compra no PDV")
                .build());

        assertThat(resp.isCancelado()).isTrue();
        assertThat(resp.getCodigoStatus()).isEqualTo("135");
        assertThat(resp.getProtocoloEvento()).isEqualTo("135260000000002");
        assertThat(resp.getStatus()).isEqualTo("CANCELADO");
        assertThat(doc.getStatus()).isEqualTo(DocumentoFiscal.StatusFiscal.CANCELADO);
        verify(repository).save(doc);
    }

    @Test
    @DisplayName("Rejeição da SEFAZ (cStat 501) mantém o documento AUTORIZADO e devolve o cStat real")
    void naoMudaStatusQuandoCancelamentoRejeitado() {
        DocumentoFiscal doc = documentoAutorizado();
        when(repository.findByChaveAcessoAndLojaId(CHAVE_44, LOJA_ID)).thenReturn(Optional.of(doc));
        when(provider.cancelar(any(DocumentoFiscal.class), anyString()))
                .thenReturn(FiscalProvider.ResultadoFiscal.rejeitado(CHAVE_44, "501",
                        "Rejeição: Prazo de cancelamento superior ao previsto na Legislação", null));

        var resp = service.cancelarNfce(NfceCancelarRequest.builder()
                .chaveAcesso(CHAVE_44)
                .justificativa("Cliente desistiu da compra no PDV")
                .build());

        assertThat(resp.isCancelado()).isFalse();
        assertThat(resp.getCodigoStatus()).isEqualTo("501");
        assertThat(resp.getMotivo()).contains("Prazo de cancelamento");
        assertThat(doc.getStatus()).isEqualTo(DocumentoFiscal.StatusFiscal.AUTORIZADO);
        verify(repository, never()).save(any(DocumentoFiscal.class));
    }

    @Test
    @DisplayName("Cancelamento recusa documento que não está AUTORIZADO")
    void deveRecusarCancelamentoDeDocumentoNaoAutorizado() {
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(LOJA_ID)
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("090").numero(3)
                .chaveAcesso(CHAVE_44)
                .status(DocumentoFiscal.StatusFiscal.REJEITADO)
                .protocolo(PROTOCOLO_15)
                .ambiente("1").tpEmis("1")
                .build();
        doc.setId(UUID.randomUUID());
        when(repository.findByChaveAcessoAndLojaId(CHAVE_44, LOJA_ID)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> service.cancelarNfce(NfceCancelarRequest.builder()
                .chaveAcesso(CHAVE_44)
                .justificativa("Cliente desistiu da compra no PDV")
                .build()))
                .isInstanceOf(com.visionbox.shared.error.BusinessException.class)
                .hasMessageContaining("REJEITADO");

        verify(provider, never()).cancelar(any(DocumentoFiscal.class), anyString());
    }

    @Test
    @DisplayName("Chave que não pertence a esta loja devolve 404")
    void deveDevolver404QuandoChaveNaoExisteNaLoja() {
        when(repository.findByChaveAcessoAndLojaId(CHAVE_44, LOJA_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cancelarNfce(NfceCancelarRequest.builder()
                .chaveAcesso(CHAVE_44)
                .justificativa("Cliente desistiu da compra no PDV")
                .build()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("Documento sem protocolo gravado busca o protocolo no provider antes de cancelar")
    void deveBuscarProtocoloNoProviderQuandoAusente() {
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(LOJA_ID)
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("090").numero(1)
                .chaveAcesso(CHAVE_44)
                .status(DocumentoFiscal.StatusFiscal.AUTORIZADO)
                .ambiente("1").tpEmis("1")
                .build();
        doc.setId(UUID.randomUUID());
        when(repository.findByChaveAcessoAndLojaId(CHAVE_44, LOJA_ID)).thenReturn(Optional.of(doc));
        when(provider.consultar(CHAVE_44))
                .thenReturn(Optional.of(new FiscalProvider.ResultadoFiscal(true, CHAVE_44, "13526007062662399",
                        "100", "Autorizado o uso da NF-e", null, java.time.OffsetDateTime.now())));
        when(provider.cancelar(any(DocumentoFiscal.class), anyString()))
                .thenReturn(new FiscalProvider.ResultadoFiscal(true, CHAVE_44, "135260000000003", "135",
                        "Evento registrado e vinculado a NF-e", null, java.time.OffsetDateTime.now()));

        var resp = service.cancelarNfce(NfceCancelarRequest.builder()
                .chaveAcesso(CHAVE_44)
                .justificativa("Cliente desistiu da compra no PDV")
                .build());

        assertThat(resp.isCancelado()).isTrue();
        // O protocolo recuperado foi usado no evento e gravado no documento.
        assertThat(doc.getProtocolo()).isEqualTo("13526007062662399");
    }

    private DocumentoFiscal documentoAutorizado() {
        DocumentoFiscal doc = DocumentoFiscal.builder()
                .lojaId(LOJA_ID)
                .modelo(DocumentoFiscal.ModeloFiscal.NFCE_65)
                .serie("090").numero(6)
                .chaveAcesso(CHAVE_44)
                .status(DocumentoFiscal.StatusFiscal.AUTORIZADO)
                .protocolo(PROTOCOLO_15)
                .ambiente("1").tpEmis("1")
                .build();
        doc.setId(UUID.randomUUID());
        return doc;
    }
}
