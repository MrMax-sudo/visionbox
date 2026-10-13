package com.visionbox.modules.modulos.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.service.ModuloConfiguracaoService;
import com.visionbox.shared.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Enforcement do {@code @RequerModulo} via {@code ModuloTenantInterceptor} (spec §4.4).
 * MockMvc standalone: isola o interceptor (sem SecurityConfig, sem contexto Spring).
 */
class ModuloTenantInterceptorTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private ModuloConfiguracaoService moduloService;
    private MockMvc mockMvc;

    /** Controller de teste — anotação no MÉTODO (caso mais comum). */
    @RestController
    @RequestMapping("/api/teste")
    static class ControllerComAnotacaoNoMetodo {
        @GetMapping("/livre")
        public String livre() {
            return "livre";
        }

        @GetMapping("/etiquetas")
        @RequerModulo(ModuloSistema.ETIQUETAS)
        public String etiquetas() {
            return "etiquetas-ok";
        }
    }

    /** Controller de teste — anotação na CLASSE (gating de módulo inteiro). */
    @RestController
    @RequestMapping("/api/classe")
    @RequerModulo(ModuloSistema.LAB_PORTAL)
    static class ControllerComAnotacaoNaClasse {
        @GetMapping("/portal")
        public String portal() {
            return "portal-ok";
        }
    }

    @BeforeEach
    void setUp() {
        moduloService = mock(ModuloConfiguracaoService.class);
        ModuloTenantInterceptor interceptor = new ModuloTenantInterceptor(moduloService, new ObjectMapper());
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new ControllerComAnotacaoNoMetodo(), new ControllerComAnotacaoNaClasse())
                .addInterceptors(interceptor)
                .build();
        TenantContext.setCurrentTenant(LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Módulo ativo na loja → 200 e handler executa")
    void moduloAtivoResponde200() throws Exception {
        when(moduloService.moduloAtivo(eq(LOJA_ID), eq(ModuloSistema.ETIQUETAS))).thenReturn(true);

        mockMvc.perform(get("/api/teste/etiquetas"))
                .andExpect(status().isOk())
                .andExpect(content().string("etiquetas-ok"));
    }

    @Test
    @DisplayName("Módulo inativo → 403 com payload MODULO_NAO_CONTRATADO (spec §4.4)")
    void moduloInativoResponde403ComPayloadPadrao() throws Exception {
        when(moduloService.moduloAtivo(eq(LOJA_ID), eq(ModuloSistema.ETIQUETAS))).thenReturn(false);

        mockMvc.perform(get("/api/teste/etiquetas"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.codigo").value("MODULO_NAO_CONTRATADO"))
                .andExpect(jsonPath("$.modulo").value("ETIQUETAS"))
                .andExpect(jsonPath("$.mensagem")
                        .value("O módulo de Impressão de Etiquetas não está liberado no plano contratado para esta loja."));
    }

    @Test
    @DisplayName("Endpoint sem @RequerModulo passa e o service nem é chamado")
    void endpointSemAnotacaoNaoValidaModulo() throws Exception {
        mockMvc.perform(get("/api/teste/livre"))
                .andExpect(status().isOk())
                .andExpect(content().string("livre"));

        verify(moduloService, never()).moduloAtivo(any(), any());
    }

    @Test
    @DisplayName("Anotação na classe do controller também bloqueia")
    void anotacaoNaClasseValida() throws Exception {
        when(moduloService.moduloAtivo(eq(LOJA_ID), eq(ModuloSistema.LAB_PORTAL))).thenReturn(false);

        mockMvc.perform(get("/api/classe/portal"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("MODULO_NAO_CONTRATADO"))
                .andExpect(jsonPath("$.modulo").value("LAB_PORTAL"));
    }

    @Test
    @DisplayName("Sem TenantContext → fail-closed 403 TENANT_AUSENTE")
    void semTenantFailClosed() throws Exception {
        TenantContext.clear();

        mockMvc.perform(get("/api/teste/etiquetas"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("TENANT_AUSENTE"))
                .andExpect(jsonPath("$.modulo").value("ETIQUETAS"));

        verify(moduloService, never()).moduloAtivo(any(), any());
    }

    @Test
    @DisplayName("@RequerModulo presente no método e na classe do controller de teste")
    void anotacaoRequerModuloPresente() throws Exception {
        var metodo = ControllerComAnotacaoNoMetodo.class.getDeclaredMethod("etiquetas");
        assertThat(metodo.getAnnotation(RequerModulo.class)).isNotNull();
        assertThat(metodo.getAnnotation(RequerModulo.class).value()).isEqualTo(ModuloSistema.ETIQUETAS);

        assertThat(ControllerComAnotacaoNaClasse.class.getAnnotation(RequerModulo.class)).isNotNull();
        assertThat(ControllerComAnotacaoNaClasse.class.getAnnotation(RequerModulo.class).value())
                .isEqualTo(ModuloSistema.LAB_PORTAL);

        assertThat(ControllerComAnotacaoNoMetodo.class.getDeclaredMethod("livre")
                .getAnnotation(RequerModulo.class)).isNull();
    }
}
