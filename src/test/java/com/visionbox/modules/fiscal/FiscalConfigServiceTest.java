package com.visionbox.modules.fiscal;

import com.visionbox.modules.fiscal.dto.FiscalConfigRequest;
import com.visionbox.modules.fiscal.dto.FiscalConfigResponse;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@DisplayName("FiscalConfigService — série e numeração configuráveis por loja (V48)")
class FiscalConfigServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private LojaRepository lojaRepository;
    private FiscalConfigService service;
    private Loja loja;

    @BeforeEach
    void setUp() {
        lojaRepository = Mockito.mock(LojaRepository.class);
        service = new FiscalConfigService(lojaRepository, Mockito.mock(FiscalProvider.class));
        loja = Loja.builder().id(LOJA_ID).nome("I LOVE MIMOS").build();
        when(lojaRepository.findById(LOJA_ID)).thenReturn(Optional.of(loja));
        when(lojaRepository.save(Mockito.any(Loja.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("Normaliza a série para 3 dígitos (formato da tabela DocumentoFiscal)")
    void normalizaSerieParaTresDigitos() {
        FiscalConfigResponse config = service.buscarConfig(LOJA_ID);

        assertThat(config.getFiscalSerieNfce()).isNull();

        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalSerieNfce("7").fiscalSerieNfe("26").build());

        assertThat(loja.getFiscalSerieNfce()).isEqualTo("007");
        assertThat(loja.getFiscalSerieNfe()).isEqualTo("026");
        assertThat(service.buscarConfig(LOJA_ID).getFiscalSerieNfce()).isEqualTo("007");
    }

    @Test
    @DisplayName("Recusa série fora do tipo TSerie do XSD (mais de 3 dígitos ou não numérica)")
    void recusaSerieInvalida() {
        assertThatThrownBy(() -> service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalSerieNfce("0007").build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Série da NFC-e inválida");

        assertThatThrownBy(() -> service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalSerieNfe("12A").build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Série da NF-e inválida");
    }

    @Test
    @DisplayName("Null preserva o valor atual e a string vazia limpa a série")
    void nullPreservaEVazioLimpa() {
        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalSerieNfce("5").build());
        assertThat(loja.getFiscalSerieNfce()).isEqualTo("005");

        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalSerieNfce(null).build());
        assertThat(loja.getFiscalSerieNfce()).isEqualTo("005");

        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalSerieNfce("").build());
        assertThat(loja.getFiscalSerieNfce()).isNull();
    }

    @Test
    @DisplayName("Número inicial aceita 1 a 999999999 (XSD TNF) e limpa com valor menor que 1")
    void validaNumeroInicial() {
        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalNumeroInicialNfce(127).build());
        assertThat(loja.getFiscalNumeroInicialNfce()).isEqualTo(127);

        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalNumeroInicialNfce(0).build());
        assertThat(loja.getFiscalNumeroInicialNfce()).isNull();

        assertThatThrownBy(() -> service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder().fiscalNumeroInicialNfe(1_000_000_000).build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Número inicial da NF-e inválido");
    }

    @Test
    @DisplayName("Cadastro fiscal completo é devolvido ao painel sem alterar nada salvo")
    void devolveConfiguracaoCompleta() {
        service.salvarConfig(LOJA_ID, FiscalConfigRequest.builder()
                .inscricaoEstadual("151957359112")
                .csc("csc-teste")
                .cscId("000001")
                .codigoMunicipio("3550308")
                .crt("1")
                .fiscalAmbiente("PRODUCAO")
                .fiscalSerieNfce("004")
                .fiscalNumeroInicialNfce(127)
                .build());

        FiscalConfigResponse config = service.buscarConfig(LOJA_ID);
        ArgumentCaptor<Loja> captor = ArgumentCaptor.forClass(Loja.class);

        assertThat(config.getInscricaoEstadual()).isEqualTo("151957359112");
        assertThat(config.getFiscalAmbiente()).isEqualTo("PRODUCAO");
        assertThat(config.getFiscalSerieNfce()).isEqualTo("004");
        assertThat(config.getFiscalNumeroInicialNfce()).isEqualTo(127);
        Mockito.verify(lojaRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(LOJA_ID);
    }
}
