package com.visionbox.modules.laboratorio;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.laboratorio.dto.LabPortalTokenRequest;
import com.visionbox.modules.laboratorio.service.LabPortalTokenService;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Lab portal token")
class LabPortalTokenServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OS_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID LAB_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final String SECRET = "secret_secret_secret_secret_32_bytes_min";

    private OrdemServicoService ordemServicoService;
    private LabPortalTokenService service;

    @BeforeEach
    void setUp() {
        ordemServicoService = mock(OrdemServicoService.class);
        service = new LabPortalTokenService(
                ordemServicoService,
                new ObjectMapper(),
                Clock.fixed(Instant.parse("2026-09-05T12:00:00Z"), ZoneOffset.UTC),
                SECRET
        );
        TenantContext.setCurrentLojaId(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("gera token assinado para OS do tenant atual")
    void deveGerarTokenAssinado() {
        when(ordemServicoService.buscarEntidade(LOJA_ID, OS_ID)).thenReturn(os(StatusOS.ENVIADO_LABORATORIO));

        var response = service.gerar(LabPortalTokenRequest.builder()
                .ordemServicoId(OS_ID)
                .laboratorioExternoId(" lab-acme ")
                .ttlMinutos(30)
                .build());

        assertThat(response.getToken()).startsWith("vlab1.");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
        assertThat(response.getLojaId()).isEqualTo(LOJA_ID);
        assertThat(response.getOrdemServicoId()).isEqualTo(OS_ID);
        assertThat(response.getLaboratorioId()).isEqualTo(LAB_ID);
        assertThat(response.getLaboratorioExternoId()).isEqualTo("lab-acme");
        assertThat(response.getStatusOs()).isEqualTo("ENVIADO_LABORATORIO");

        Map<String, Object> payload = service.validarToken(response.getToken());
        assertThat(payload).containsEntry("scope", "LAB_PORTAL_OS");
        assertThat(payload).containsEntry("lojaId", LOJA_ID.toString());
        assertThat(payload).containsEntry("ordemServicoId", OS_ID.toString());
        assertThat(payload).containsEntry("laboratorioId", LAB_ID.toString());
        assertThat(payload).containsEntry("laboratorioExternoId", "lab-acme");
        verify(ordemServicoService).buscarEntidade(LOJA_ID, OS_ID);
    }

    @Test
    @DisplayName("bloqueia token para OS terminal")
    void deveBloquearStatusTerminal() {
        when(ordemServicoService.buscarEntidade(LOJA_ID, OS_ID)).thenReturn(os(StatusOS.ENTREGUE));

        assertThatThrownBy(() -> service.gerar(LabPortalTokenRequest.builder()
                .ordemServicoId(OS_ID)
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("não elegível");
    }

    @Test
    @DisplayName("rejeita token adulterado")
    void deveRejeitarTokenAdulterado() {
        when(ordemServicoService.buscarEntidade(LOJA_ID, OS_ID)).thenReturn(os(StatusOS.EM_PRODUCAO));
        var response = service.gerar(LabPortalTokenRequest.builder()
                .ordemServicoId(OS_ID)
                .build());
        String adulterado = response.getToken().replace("vlab1.", "vlab1.x");

        assertThatThrownBy(() -> service.validarToken(adulterado))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inválido");
    }

    private OrdemServico os(StatusOS status) {
        return OrdemServico.builder()
                .id(OS_ID)
                .lojaId(LOJA_ID)
                .numero("OS-2026-00001")
                .clienteId(UUID.randomUUID())
                .laboratorioId(LAB_ID)
                .status(status)
                .build();
    }
}
