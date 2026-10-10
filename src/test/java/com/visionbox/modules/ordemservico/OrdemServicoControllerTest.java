package com.visionbox.modules.ordemservico;

import com.visionbox.modules.ordemservico.controller.OrdemServicoController;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.modules.ordemservico.service.RastreioTokenService;
import com.visionbox.modules.ordemservico.service.SlaService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("OrdemServicoController — Endpoints e Rastreio Token (US17)")
class OrdemServicoControllerTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OS_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private OrdemServicoService service;
    private SlaService slaService;
    private RastreioTokenService rastreioTokenService;
    private OrdemServicoController controller;

    @BeforeEach
    void setUp() {
        service = mock(OrdemServicoService.class);
        slaService = mock(SlaService.class);
        rastreioTokenService = mock(RastreioTokenService.class);
        controller = new OrdemServicoController(service, slaService, rastreioTokenService);
        TenantContext.setCurrentLojaId(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("GET /api/v1/ordens-servico/{id}/rastreio-token gera token assinado e URL pública")
    void obterTokenRastreioComSucesso() {
        String mockToken = "rpub1.payload.assinatura";
        when(rastreioTokenService.gerar(LOJA_ID, OS_ID)).thenReturn(mockToken);

        ResponseEntity<Map<String, String>> response = controller.obterTokenRastreio(OS_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("token")).isEqualTo(mockToken);
        assertThat(response.getBody().get("url")).isEqualTo("/rastreio/" + mockToken);
    }

    @Test
    @DisplayName("POST /api/v1/ordens-servico cria OS e retorna 201 CREATED")
    void criarOSComSucesso() {
        OrdemServicoRequest req = OrdemServicoRequest.builder()
                .clienteId(UUID.randomUUID())
                .build();
        OrdemServicoResponse res = OrdemServicoResponse.builder()
                .id(OS_ID)
                .numero("OS-2026-00001")
                .build();
        when(service.criar(req)).thenReturn(res);

        ResponseEntity<OrdemServicoResponse> response = controller.criar(req);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getId()).isEqualTo(OS_ID);
        assertThat(response.getBody().getNumero()).isEqualTo("OS-2026-00001");
    }
}
