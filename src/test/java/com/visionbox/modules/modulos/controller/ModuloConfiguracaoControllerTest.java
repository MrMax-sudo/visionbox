package com.visionbox.modules.modulos.controller;

import com.visionbox.modules.modulos.dto.ModuloDtos.AlternarModulosRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.AplicarPlanoRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.ItemModuloRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.ModuloConfiguracaoStatusResponse;
import com.visionbox.modules.modulos.service.ModuloConfiguracaoService;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Fase 5 — endpoints do Painel do Desenvolvedor: autorização, troca de escopo de tenant
 * (loja do path) com restauração garantida e presença de {@code @PreAuthorize}.
 */
class ModuloConfiguracaoControllerTest {

    private static final UUID LOJA_OPERADOR = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID LOJA_ALVO = UUID.fromString("22222222-2222-2222-2222-222222222222");

    private ModuloConfiguracaoService service;
    private ModuloConfiguracaoController controller;
    private HttpServletRequest httpRequest;

    @BeforeEach
    void setUp() {
        service = mock(ModuloConfiguracaoService.class);
        controller = new ModuloConfiguracaoController(service);
        httpRequest = mock(HttpServletRequest.class);
        when(httpRequest.getRemoteAddr()).thenReturn("10.0.0.7");
        TenantContext.setCurrentTenant(LOJA_OPERADOR);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private ModuloConfiguracaoStatusResponse resposta() {
        return new ModuloConfiguracaoStatusResponse(LOJA_ALVO, "PADRAO", false, List.of());
    }

    @Test
    @DisplayName("GET delega após autorizar e executa o service com o tenant da loja do path")
    void listarExecutaNoEscopoDaLojaAlvo() {
        AtomicReference<UUID> tenantNaChamada = new AtomicReference<>();
        when(service.listarStatus(LOJA_ALVO)).thenAnswer(inv -> {
            tenantNaChamada.set(TenantContext.getLojaId());
            return resposta();
        });

        ModuloConfiguracaoStatusResponse resp = controller.listarModulos(LOJA_ALVO);

        verify(service).autorizarAcessoLoja(LOJA_ALVO);
        assertThat(tenantNaChamada.get()).isEqualTo(LOJA_ALVO);
        assertThat(resp.lojaId()).isEqualTo(LOJA_ALVO);
        // tenant do operador restaurado após a chamada
        assertThat(TenantContext.getLojaId()).isEqualTo(LOJA_OPERADOR);
    }

    @Test
    @DisplayName("PUT de plano delega com IP de auditoria e restaura o tenant em caso de erro")
    void aplicarPlanoRestauraTenantMesmoComErro() {
        when(service.aplicarPlano(eq(LOJA_ALVO), any(), eq("10.0.0.7")))
                .thenThrow(new IllegalArgumentException("Plano inválido"));

        assertThatThrownBy(() -> controller.aplicarPlano(
                LOJA_ALVO, new AplicarPlanoRequest("TITANIO"), httpRequest))
                .isInstanceOf(IllegalArgumentException.class);

        verify(service).autorizarAcessoLoja(LOJA_ALVO);
        assertThat(TenantContext.getLojaId()).isEqualTo(LOJA_OPERADOR);
    }

    @Test
    @DisplayName("PUT de toggle delega o payload com o IP do request (auditoria: quem/quando)")
    void alternarDelegaPayloadEIp() {
        AtomicReference<UUID> tenantNaChamada = new AtomicReference<>();
        when(service.alternarModulos(eq(LOJA_ALVO), any(), eq("10.0.0.7"))).thenAnswer(inv -> {
            tenantNaChamada.set(TenantContext.getLojaId());
            return resposta();
        });

        var req = new AlternarModulosRequest(
                List.of(new ItemModuloRequest("ETIQUETAS", false)), "add-on");
        controller.alternarModulos(LOJA_ALVO, req, httpRequest);

        assertThat(tenantNaChamada.get()).isEqualTo(LOJA_ALVO);
        assertThat(TenantContext.getLojaId()).isEqualTo(LOJA_OPERADOR);
    }

    @Test
    @DisplayName("@PreAuthorize restringe /dev/lojas a ADMIN|DESENVOLVEDOR (defesa em profundidade)")
    void preAuthorizePresenteNaClasse() {
        PreAuthorize anotacao = ModuloConfiguracaoController.class.getAnnotation(PreAuthorize.class);
        assertThat(anotacao).isNotNull();
        assertThat(anotacao.value()).contains("ADMIN").contains("DESENVOLVEDOR");
    }
}
