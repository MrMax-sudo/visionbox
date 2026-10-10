package com.visionbox.modules.ordemservico;

import com.visionbox.modules.ordemservico.controller.RastreioController;
import com.visionbox.modules.ordemservico.dto.RastreioBuscaResponse;
import com.visionbox.modules.ordemservico.dto.RastreioResponse;
import com.visionbox.modules.ordemservico.service.RastreioService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@DisplayName("RastreioController — Endpoints Públicos de Rastreio (US17)")
class RastreioControllerTest {

    private RastreioService service;
    private SimpleMeterRegistry meterRegistry;
    private RastreioController controller;

    @BeforeEach
    void setUp() {
        service = mock(RastreioService.class);
        meterRegistry = new SimpleMeterRegistry();
        controller = new RastreioController(service, meterRegistry);
    }

    @Test
    @DisplayName("buscarPorNumero incrementa métrica e devolve 200 OK")
    void buscarPorNumero_sucesso() {
        RastreioResponse ordem = RastreioResponse.builder()
                .numeroOs("OS-12345")
                .statusAtual("PRONTO")
                .build();
        RastreioBuscaResponse mockResp = RastreioBuscaResponse.builder()
                .token("tok123")
                .ordem(ordem)
                .build();
        when(service.buscarPorNumero("OS-12345")).thenReturn(mockResp);

        ResponseEntity<RastreioBuscaResponse> response = controller.buscarPorNumero("OS-12345");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getToken()).isEqualTo("tok123");
        assertThat(response.getBody().getOrdem().getNumeroOs()).isEqualTo("OS-12345");

        double count = meterRegistry.counter("visionbox_rastreio_busca_total").count();
        assertThat(count).isEqualTo(1.0);
    }

    @Test
    @DisplayName("buscarPorToken devolve 200 OK")
    void buscarPorToken_sucesso() {
        RastreioResponse mockResp = RastreioResponse.builder()
                .numeroOs("OS-12345")
                .statusAtual("PRONTO")
                .build();
        when(service.buscarPorToken("valid-token")).thenReturn(mockResp);

        ResponseEntity<RastreioResponse> response = controller.buscarPorToken("valid-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatusAtual()).isEqualTo("PRONTO");
    }
}
