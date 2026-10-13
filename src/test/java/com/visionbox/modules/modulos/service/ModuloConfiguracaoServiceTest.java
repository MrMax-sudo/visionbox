package com.visionbox.modules.modulos.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.modulos.domain.ModuloConfiguracaoLoja;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.domain.PlanoSaaS;
import com.visionbox.modules.modulos.dto.ModuloDtos.AlternarModulosRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.AplicarPlanoRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.ItemModuloRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.ModuloConfiguracaoStatusResponse;
import com.visionbox.modules.modulos.repository.ModuloConfiguracaoLojaRepository;
import com.visionbox.modules.pessoa.domain.Loja;
import com.visionbox.modules.pessoa.repository.LojaRepository;
import com.visionbox.shared.audit.LogAuditoria;
import com.visionbox.shared.audit.LogAuditoriaRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Fase 5 — Gestor SaaS de Módulos & Planos: default sem registro, aplicação de plano,
 * toggle granular, autorização cross-tenant e auditoria.
 */
class ModuloConfiguracaoServiceTest {

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OUTRA_LOJA_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID OPERADOR_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private ModuloConfiguracaoLojaRepository moduloRepository;
    private LojaRepository lojaRepository;
    private LogAuditoriaRepository logAuditoriaRepository;
    private ModuloConfiguracaoService service;

    @BeforeEach
    void setUp() {
        moduloRepository = mock(ModuloConfiguracaoLojaRepository.class);
        lojaRepository = mock(LojaRepository.class);
        logAuditoriaRepository = mock(LogAuditoriaRepository.class);
        service = new ModuloConfiguracaoService(moduloRepository, lojaRepository,
                logAuditoriaRepository, new ObjectMapper());
        autenticar("DESENVOLVEDOR", LOJA_ID);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void autenticar(String perfil, UUID lojaId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(OPERADOR_ID.toString())
                .claim("loja_id", lojaId.toString())
                .claim("perfil", perfil)
                .claim("nome", "Operador Teste")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    private ModuloConfiguracaoLoja linha(String codigo, boolean ativo, String plano) {
        return ModuloConfiguracaoLoja.builder()
                .lojaId(LOJA_ID)
                .moduloCodigo(codigo)
                .ativo(ativo)
                .planoNome(plano)
                .build();
    }

    // ---------------------------------------------------------------------
    // Leitura / default retrocompatível
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("Sem registro na tabela → todos os módulos ativos (default retrocompatível)")
    void listarStatusSemRegistroTodosAtivos() {
        when(moduloRepository.findByLojaId(LOJA_ID)).thenReturn(List.of());

        ModuloConfiguracaoStatusResponse status = service.listarStatus(LOJA_ID);

        assertThat(status.lojaId()).isEqualTo(LOJA_ID);
        assertThat(status.registrosExistem()).isFalse();
        assertThat(status.planoAtual()).isEqualTo("PADRAO");
        assertThat(status.modulos()).hasSize(ModuloSistema.values().length);
        assertThat(status.modulos()).allSatisfy(m -> {
            assertThat(m.ativo()).isTrue();
            assertThat(m.fonte()).isEqualTo("PADRAO");
        });
    }

    @Test
    @DisplayName("Registro com ativo=false desliga só aquele módulo; os demais seguem default")
    void listarStatusComRegistroInativo() {
        when(moduloRepository.findByLojaId(LOJA_ID)).thenReturn(List.of(linha("ETIQUETAS", false, "PERSONALIZADO")));

        ModuloConfiguracaoStatusResponse status = service.listarStatus(LOJA_ID);

        assertThat(status.registrosExistem()).isTrue();
        assertThat(status.planoAtual()).isEqualTo("PERSONALIZADO");
        assertThat(status.modulos().stream().filter(m -> !m.ativo()).map(m -> m.codigo()))
                .containsExactly("ETIQUETAS");
        assertThat(status.modulos().stream().filter(m -> "ETIQUETAS".equals(m.codigo())).findFirst().orElseThrow()
                .fonte()).isEqualTo("REGISTRO");
    }

    @Test
    @DisplayName("moduloAtivo: sem registro → true (default); registro inativo → false")
    void moduloAtivoDefaultEURegistro() {
        when(moduloRepository.findByLojaIdAndModuloCodigo(LOJA_ID, "ETIQUETAS"))
                .thenReturn(Optional.empty());
        assertThat(service.moduloAtivo(LOJA_ID, ModuloSistema.ETIQUETAS)).isTrue();

        when(moduloRepository.findByLojaIdAndModuloCodigo(LOJA_ID, "ETIQUETAS"))
                .thenReturn(Optional.of(linha("ETIQUETAS", false, "START")));
        assertThat(service.moduloAtivo(LOJA_ID, ModuloSistema.ETIQUETAS)).isFalse();
    }

    // ---------------------------------------------------------------------
    // Aplicação de plano (matriz §4.2)
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("Aplicar START grava os 19 módulos: só os 3 da matriz ativos e auditoria gerada")
    void aplicarPlanoStartGravaMatrizCompleta() {
        when(moduloRepository.findByLojaId(LOJA_ID)).thenReturn(List.of());

        ModuloConfiguracaoStatusResponse status = service.aplicarPlano(LOJA_ID,
                new AplicarPlanoRequest("START"), "10.0.0.1");

        ArgumentCaptor<ModuloConfiguracaoLoja> captor = ArgumentCaptor.forClass(ModuloConfiguracaoLoja.class);
        verify(moduloRepository, org.mockito.Mockito.times(ModuloSistema.values().length)).save(captor.capture());
        List<ModuloConfiguracaoLoja> salvas = captor.getAllValues();
        assertThat(salvas).hasSize(19);
        assertThat(salvas).allSatisfy(l -> {
            assertThat(l.getLojaId()).isEqualTo(LOJA_ID);
            assertThat(l.getPlanoNome()).isEqualTo("START");
        });
        Set<String> ativos = new java.util.HashSet<>();
        salvas.stream().filter(ModuloConfiguracaoLoja::isAtivo)
                .forEach(l -> ativos.add(l.getModuloCodigo()));
        assertThat(ativos).containsExactlyInAnyOrder("PDV_BALCAO", "CENTRAL_VENDAS", "CAIXA_TURNOS");

        ArgumentCaptor<LogAuditoria> auditCaptor = ArgumentCaptor.forClass(LogAuditoria.class);
        verify(logAuditoriaRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getLojaId()).isEqualTo(LOJA_ID);
        assertThat(auditCaptor.getValue().getEntidade()).isEqualTo("modulo_configuracao_loja");
        assertThat(auditCaptor.getValue().getUsuarioNome()).isEqualTo("Operador Teste");
        assertThat(auditCaptor.getValue().getUsuarioId()).isEqualTo(OPERADOR_ID.toString());
        assertThat(auditCaptor.getValue().getDetalheJson()).contains("APLICAR_PLANO").contains("START");

        assertThat(status.lojaId()).isEqualTo(LOJA_ID);
    }

    @Test
    @DisplayName("Aplicar PRO mantém Start e habilita o núcleo ótico (matriz §4.2)")
    void aplicarPlanoProIncluiNucleoOtico() {
        when(moduloRepository.findByLojaId(LOJA_ID)).thenReturn(List.of());

        service.aplicarPlano(LOJA_ID, new AplicarPlanoRequest("pro"), "10.0.0.1");

        ArgumentCaptor<ModuloConfiguracaoLoja> captor = ArgumentCaptor.forClass(ModuloConfiguracaoLoja.class);
        verify(moduloRepository, org.mockito.Mockito.times(19)).save(captor.capture());
        List<ModuloConfiguracaoLoja> salvas = captor.getAllValues();
        for (String codigo : List.of("PDV_BALCAO", "ORDEM_SERVICO", "RECEITAS_CLINICAS", "FISCAL_FLOWBOX",
                "LAB_PORTAL", "RASTREIO_CLIENTE", "ESTOQUE_LOTES")) {
            assertThat(salvas.stream().filter(l -> codigo.equals(l.getModuloCodigo())).findFirst().orElseThrow()
                    .isAtivo()).as(codigo).isTrue();
        }
        assertThat(salvas.stream().filter(l -> "ETIQUETAS".equals(l.getModuloCodigo())).findFirst().orElseThrow()
                .isAtivo()).isFalse();
    }

    @Test
    @DisplayName("PERSONALIZADO e nome de plano inválido → IllegalArgumentException (400)")
    void aplicarPlanoRejeitaPersonalizadoEInvalido() {
        assertThatThrownBy(() -> service.aplicarPlano(LOJA_ID, new AplicarPlanoRequest("PERSONALIZADO"), "ip"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("toggle granular");

        assertThatThrownBy(() -> service.aplicarPlano(LOJA_ID, new AplicarPlanoRequest("TITANIO"), "ip"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Plano inválido");

        verify(moduloRepository, never()).save(any());
        verify(logAuditoriaRepository, never()).save(any());
    }

    // ---------------------------------------------------------------------
    // Toggle granular
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("Toggle cria linha quando não existe e audita a alteração")
    void alternarCriaRegistroEAudita() {
        // banco em memória: o save alimenta a listagem final devolvida pelo service
        List<ModuloConfiguracaoLoja> banco = new java.util.ArrayList<>();
        when(moduloRepository.findByLojaId(LOJA_ID)).thenAnswer(inv -> new java.util.ArrayList<>(banco));
        when(moduloRepository.save(any())).thenAnswer(inv -> {
            ModuloConfiguracaoLoja salva = inv.getArgument(0);
            banco.add(salva);
            return salva;
        });

        ModuloConfiguracaoStatusResponse status = service.alternarModulos(LOJA_ID,
                new AlternarModulosRequest(List.of(new ItemModuloRequest("ETIQUETAS", false)), "add-on avulso"),
                "10.0.0.9");

        ArgumentCaptor<ModuloConfiguracaoLoja> captor = ArgumentCaptor.forClass(ModuloConfiguracaoLoja.class);
        verify(moduloRepository).save(captor.capture());
        assertThat(captor.getValue().getModuloCodigo()).isEqualTo("ETIQUETAS");
        assertThat(captor.getValue().isAtivo()).isFalse();
        assertThat(captor.getValue().getPlanoNome()).isEqualTo("PERSONALIZADO");

        ArgumentCaptor<LogAuditoria> auditCaptor = ArgumentCaptor.forClass(LogAuditoria.class);
        verify(logAuditoriaRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getDetalheJson())
                .contains("ALTERNAR_MODULOS")
                .contains("add-on avulso")
                .contains("ETIQUETAS");
        assertThat(status.registrosExistem()).isTrue();
        assertThat(status.modulos().stream().filter(m -> !m.ativo()).map(m -> m.codigo()))
                .containsExactly("ETIQUETAS");
    }

    @Test
    @DisplayName("Toggle sem mudança real não gera linha de auditoria")
    void alternarSemMudancaNaoAudita() {
        when(moduloRepository.findByLojaId(LOJA_ID)).thenReturn(List.of(linha("ETIQUETAS", true, "START")));

        service.alternarModulos(LOJA_ID,
                new AlternarModulosRequest(List.of(new ItemModuloRequest("ETIQUETAS", true)), null), "ip");

        verify(moduloRepository, never()).save(any());
        verify(logAuditoriaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Código de módulo desconhecido ou repetido → IllegalArgumentException (400)")
    void alternarValidaPayload() {
        when(moduloRepository.findByLojaId(LOJA_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> service.alternarModulos(LOJA_ID,
                new AlternarModulosRequest(List.of(new ItemModuloRequest("MODULO_INEXISTENTE", true)), null), "ip"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Código de módulo inválido");

        assertThatThrownBy(() -> service.alternarModulos(LOJA_ID,
                new AlternarModulosRequest(List.of(
                        new ItemModuloRequest("ETIQUETAS", true),
                        new ItemModuloRequest("etiquetas", false)), null), "ip"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duplicado");

        verify(moduloRepository, never()).save(any());
    }

    // ---------------------------------------------------------------------
    // Autorização cross-tenant (defesa em profundidade além do SecurityConfig)
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("DESENVOLVEDOR gerencia qualquer loja")
    void desenvolvedorAcessaQualquerLoja() {
        autenticar("DESENVOLVEDOR", LOJA_ID);
        service.autorizarAcessoLoja(OUTRA_LOJA_ID);
    }

    @Test
    @DisplayName("ADMIN gerencia apenas a própria loja")
    void adminSoPropriaLoja() {
        autenticar("ADMIN", LOJA_ID);
        service.autorizarAcessoLoja(LOJA_ID);

        assertThatThrownBy(() -> service.autorizarAcessoLoja(OUTRA_LOJA_ID))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("DESENVOLVEDOR");
    }

    @Test
    @DisplayName("Seletor de lojas: DESENVOLVEDOR vê todas; ADMIN vê só a própria")
    void seletorDeLojasPorPerfil() {
        Loja propria = Loja.builder().id(LOJA_ID).nome("Ótica Própria").cnpj("1").build();
        Loja outra = Loja.builder().id(OUTRA_LOJA_ID).nome("Ótica Outra").cnpj("2").build();

        autenticar("DESENVOLVEDOR", LOJA_ID);
        when(lojaRepository.findAll()).thenReturn(List.of(propria, outra));
        assertThat(service.listarLojasPermitidas()).hasSize(2);

        autenticar("ADMIN", LOJA_ID);
        when(lojaRepository.findById(LOJA_ID)).thenReturn(Optional.of(propria));
        var visiveis = service.listarLojasPermitidas();
        assertThat(visiveis).hasSize(1);
        assertThat(visiveis.get(0).id()).isEqualTo(LOJA_ID);
        assertThat(visiveis.get(0).nome()).isEqualTo("Ótica Própria");
    }

    // ---------------------------------------------------------------------
    // Matriz de planos (spec §4.2)
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("Matrizes progressivas: START ⊂ PRO ⊂ ENTERPRISE cobrem os 19 módulos")
    void matrizesDePlanosSaoProgressivasECobremTodos() {
        assertThat(PlanoSaaS.START.getModulos()).isSubsetOf(PlanoSaaS.PRO.getModulos());
        assertThat(PlanoSaaS.PRO.getModulos()).isSubsetOf(PlanoSaaS.ENTERPRISE.getModulos());
        assertThat(PlanoSaaS.ENTERPRISE.getModulos()).hasSize(ModuloSistema.values().length);
        assertThat(PlanoSaaS.START.getModulos()).containsExactlyInAnyOrder(
                ModuloSistema.PDV_BALCAO, ModuloSistema.CENTRAL_VENDAS, ModuloSistema.CAIXA_TURNOS);

        assertThat(PlanoSaaS.compativelCom(Set.copyOf(PlanoSaaS.ENTERPRISE.getModulos())))
                .isEqualTo(PlanoSaaS.ENTERPRISE);
        assertThat(PlanoSaaS.compativelCom(Set.of(ModuloSistema.PDV_BALCAO))).isNull();
    }
}
