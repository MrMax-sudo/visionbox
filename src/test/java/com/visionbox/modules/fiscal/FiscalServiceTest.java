package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.NfceEmitirRequest;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("FiscalService — mock fiscal e contrato de contingencia M2")
class FiscalServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final String CHAVE_44 = "12345678901234567890123456789012345678901234";
    private static final String PROTOCOLO_15 = "123456789012345";

    private FiscalProvider provider;
    private DocumentoFiscalRepository repository;
    private FiscalService service;

    @BeforeEach
    void setUp() {
        provider = mock(FiscalProvider.class);
        repository = mock(DocumentoFiscalRepository.class);
        service = new FiscalService(provider, repository);

        TenantContext.setCurrentLojaId(LOJA_ID);
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
        when(provider.emitir(any(DocumentoFiscal.class), anyString()))
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
        verify(provider).emitir(docCaptor.capture(), anyString());
        DocumentoFiscal enviadoAoProvider = docCaptor.getValue();
        assertThat(enviadoAoProvider.getLojaId()).isEqualTo(LOJA_ID);
        assertThat(enviadoAoProvider.getModelo()).isEqualTo(DocumentoFiscal.ModeloFiscal.NFCE_65);
        assertThat(enviadoAoProvider.getStatus()).isEqualTo(DocumentoFiscal.StatusFiscal.AUTORIZADO);
    }

    @Test
    @DisplayName("NFE_55 rejeitada deve persistir status REJEITADO sem autorizar indevidamente")
    void devePropagarRejeicaoDoProvider() {
        when(provider.emitir(any(DocumentoFiscal.class), anyString()))
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
}
