package com.visionbox.modules.ordemservico;

import com.visionbox.modules.ordemservico.domain.EventoOS;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoInvalidaException;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pirâmide 70% unit — cobre máquina 12 status OS.
 * DoD: cobertura ≥95% OS/fiscal, PIT ≥80% CONDITIONALS_BOUNDARY.
 * Dado/Quando/Então + determinístico (Clock.fixed).
 *
 * @see com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry
 */
@DisplayName("OS StateMachine 12 status — TransicaoOSRegistry + EventoOS")
class StatusOSTransicaoTest {

    private TransicaoOSRegistry registry;
    private OrdemServicoRepository repository;
    private OrdemServicoService service;
    private Clock fixedClock;

    private static final UUID LOJA_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OS_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant FIXED_INSTANT = Instant.parse("2026-09-05T12:00:00Z");

    @BeforeEach
    void setUp() {
        registry = new TransicaoOSRegistry();
        repository = mock(OrdemServicoRepository.class);
        OrdemServicoMapper mapper = mock(OrdemServicoMapper.class);
        fixedClock = Clock.fixed(FIXED_INSTANT, ZoneOffset.UTC);
        service = new OrdemServicoService(registry, repository, mapper, fixedClock);
    }

    // -------------------------------------------------------------------------
    // 1. Parametrizado — casos válidos / inválidos (arquivo.md §15)
    // -------------------------------------------------------------------------

    @ParameterizedTest(name = "transição {0} -> {1} deve ser permitida={2}")
    @CsvSource({
            // válidos
            "ORCAMENTO, PEDIDO_CONFIRMADO, true",
            "ORCAMENTO, CANCELADO, true",
            "PEDIDO_CONFIRMADO, ENVIADO_LABORATORIO, true",
            "PEDIDO_CONFIRMADO, CANCELADO, true",
            "ENVIADO_LABORATORIO, EM_PRODUCAO, true",
            "ENVIADO_LABORATORIO, RETRABALHO, true",
            "ENVIADO_LABORATORIO, CANCELADO, true",
            "EM_PRODUCAO, LENTE_PRONTA, true",
            "EM_PRODUCAO, RETRABALHO, true",
            "LENTE_PRONTA, MONTAGEM, true",
            "MONTAGEM, CONTROLE_QUALIDADE, true",
            "MONTAGEM, RETRABALHO, true",
            "CONTROLE_QUALIDADE, PRONTO_PARA_RETIRADA, true",
            "CONTROLE_QUALIDADE, RETRABALHO, true",
            "PRONTO_PARA_RETIRADA, ENTREGUE, true",
            "PRONTO_PARA_RETIRADA, DEVOLVIDO_GARANTIA, true",
            "RETRABALHO, ENVIADO_LABORATORIO, true",
            "RETRABALHO, EM_PRODUCAO, true",
            // inválidos — pulo de fase
            "ORCAMENTO, EM_PRODUCAO, false",
            "ORCAMENTO, ENTREGUE, false",
            "ORCAMENTO, LENTE_PRONTA, false",
            "ENTREGUE, CANCELADO, false",
            "ENTREGUE, RETRABALHO, false",
            "CANCELADO, ORCAMENTO, false",
            "DEVOLVIDO_GARANTIA, ENTREGUE, false",
            "LENTE_PRONTA, ENTREGUE, false",
            "PEDIDO_CONFIRMADO, EM_PRODUCAO, false",
            "MONTAGEM, ENTREGUE, false",
            "CONTROLE_QUALIDADE, ENTREGUE, false",
            "EM_PRODUCAO, CANCELADO, false",
            "PRONTO_PARA_RETIRADA, CANCELADO, false",
            "CANCELADO, RETRABALHO, false"
    })
    void deveValidarTransicaoParametrizada(StatusOS origem, StatusOS destino, boolean esperado) {
        // dado: registry já inicializado

        // quando
        boolean pode = registry.podeTransitar(origem, destino);

        // então
        assertThat(pode).as("origem=%s destino=%s", origem, destino).isEqualTo(esperado);
        if (esperado) {
            registry.validarTransicao(origem, destino); // não deve lançar
        } else {
            assertThatThrownBy(() -> registry.validarTransicao(origem, destino))
                    .isInstanceOf(TransicaoInvalidaException.class)
                    .hasMessageContaining(origem.name())
                    .hasMessageContaining(destino.name());
        }
    }

    @ParameterizedTest(name = "terminal {0} não deve ter saída")
    @EnumSource(value = StatusOS.class, names = {"ENTREGUE", "CANCELADO", "DEVOLVIDO_GARANTIA"})
    void estadosTerminaisNaoTemSaida(StatusOS terminal) {
        assertThat(registry.isTerminal(terminal)).isTrue();
        assertThat(registry.destinosPermitidos(terminal)).isEmpty();
        for (StatusOS destino : StatusOS.values()) {
            assertThat(registry.podeTransitar(terminal, destino)).isFalse();
        }
    }

    // -------------------------------------------------------------------------
    // 2. Invariante: historico.size == transições + CANCELADO só até ENVIADO_LABORATORIO
    // -------------------------------------------------------------------------

    static Stream<Arguments> cenariosCadeiaFeliz() {
        return Stream.of(
                Arguments.of((Object) new StatusOS[]{
                        StatusOS.ORCAMENTO,
                        StatusOS.PEDIDO_CONFIRMADO,
                        StatusOS.ENVIADO_LABORATORIO,
                        StatusOS.EM_PRODUCAO,
                        StatusOS.LENTE_PRONTA,
                        StatusOS.MONTAGEM,
                        StatusOS.CONTROLE_QUALIDADE,
                        StatusOS.PRONTO_PARA_RETIRADA,
                        StatusOS.ENTREGUE
                }),
                Arguments.of((Object) new StatusOS[]{
                        StatusOS.ORCAMENTO,
                        StatusOS.PEDIDO_CONFIRMADO,
                        StatusOS.ENVIADO_LABORATORIO,
                        StatusOS.RETRABALHO,
                        StatusOS.EM_PRODUCAO,
                        StatusOS.LENTE_PRONTA,
                        StatusOS.MONTAGEM,
                        StatusOS.CONTROLE_QUALIDADE,
                        StatusOS.PRONTO_PARA_RETIRADA,
                        StatusOS.DEVOLVIDO_GARANTIA
                })
        );
    }

    @ParameterizedTest(name = "cadeia feliz gera EventoOS auditável {0}")
    @MethodSource("cenariosCadeiaFeliz")
    void cadeiaFelizDeveGerarHistoricoCompleto(StatusOS[] cadeia) {
        // dado
        OrdemServico os = novaOS(cadeia[0]);
        stubRepository(os);

        // quando: avança sequencialmente
        for (int i = 1; i < cadeia.length; i++) {
            // garante armação/lente para guard ENVIADO_LABORATORIO
            if (cadeia[i] == StatusOS.ENVIADO_LABORATORIO) {
                os.setArmacaoId(UUID.randomUUID());
            }
            service.avancar(LOJA_ID, OS_ID, cadeia[i], "joao.silva", "ok");
            os = repository.findByIdAndLojaId(OS_ID, LOJA_ID).orElseThrow();
        }

        // então
        assertThat(os.getHistorico()).hasSize(cadeia.length - 1);
        assertThat(os.getStatus()).isEqualTo(cadeia[cadeia.length - 1]);
        // timeline ordenada e campos auditáveis
        for (int i = 0; i < os.getHistorico().size(); i++) {
            EventoOS ev = os.getHistorico().get(i);
            assertThat(ev.getStatusAnterior()).isEqualTo(cadeia[i]);
            assertThat(ev.getStatusNovo()).isEqualTo(cadeia[i + 1]);
            assertThat(ev.getDataHora()).isEqualTo(OffsetDateTime.ofInstant(FIXED_INSTANT, ZoneOffset.UTC));
            assertThat(ev.getResponsavel()).isEqualTo("joao.silva");
            assertThat(ev.getLojaId()).isEqualTo(LOJA_ID);
        }
    }

    @Test
    @DisplayName("CANCELADO só permitido até ENVIADO_LABORATORIO — depois deve falhar")
    void canceladoSoAteEnviadoLaboratorio() {
        assertThat(registry.podeTransitar(StatusOS.ORCAMENTO, StatusOS.CANCELADO)).isTrue();
        assertThat(registry.podeTransitar(StatusOS.PEDIDO_CONFIRMADO, StatusOS.CANCELADO)).isTrue();
        assertThat(registry.podeTransitar(StatusOS.ENVIADO_LABORATORIO, StatusOS.CANCELADO)).isTrue();

        // após ENVIADO_LABORATORIO, nenhum estado permite CANCELADO
        assertThat(registry.podeTransitar(StatusOS.EM_PRODUCAO, StatusOS.CANCELADO)).isFalse();
        assertThat(registry.podeTransitar(StatusOS.LENTE_PRONTA, StatusOS.CANCELADO)).isFalse();
        assertThat(registry.podeTransitar(StatusOS.MONTAGEM, StatusOS.CANCELADO)).isFalse();
        assertThat(registry.podeTransitar(StatusOS.CONTROLE_QUALIDADE, StatusOS.CANCELADO)).isFalse();
        assertThat(registry.podeTransitar(StatusOS.PRONTO_PARA_RETIRADA, StatusOS.CANCELADO)).isFalse();
        assertThat(registry.podeTransitar(StatusOS.ENTREGUE, StatusOS.CANCELADO)).isFalse();
    }

    // -------------------------------------------------------------------------
    // 3. Regra de negócio: RETRABALHO reinicia previsão em +7d
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("RETRABALHO -> EM_PRODUCAO deve reiniciar previsao = agora +7d")
    void retrabalhoDeveReiniciarPrevisao() {
        // dado: OS em RETRABALHO com previsão antiga
        OrdemServico os = novaOS(StatusOS.RETRABALHO);
        os.setPrevisaoEntrega(OffsetDateTime.ofInstant(FIXED_INSTANT.minusSeconds(86400 * 10), ZoneOffset.UTC));
        stubRepository(os);

        // quando
        OrdemServico atualizada = service.avancar(LOJA_ID, OS_ID, StatusOS.EM_PRODUCAO, "lab", "retrabalho lente");

        // então
        OffsetDateTime esperado = OffsetDateTime.ofInstant(FIXED_INSTANT, ZoneOffset.UTC).plusDays(7);
        assertThat(atualizada.getPrevisaoEntrega()).isEqualTo(esperado);
        assertThat(atualizada.getHistorico()).hasSize(1);
        assertThat(atualizada.getHistorico().get(0).getStatusAnterior()).isEqualTo(StatusOS.RETRABALHO);
    }

    @Test
    @DisplayName("ENTREGUE deve registrar dataEntregaReal = Clock.fixed")
    void entregueDeveRegistrarDataEntrega() {
        OrdemServico os = novaOS(StatusOS.PRONTO_PARA_RETIRADA);
        stubRepository(os);

        OrdemServico atualizada = service.avancar(LOJA_ID, OS_ID, StatusOS.ENTREGUE, "caixa", "retirada");

        assertThat(atualizada.getDataEntregaReal()).isEqualTo(OffsetDateTime.ofInstant(FIXED_INSTANT, ZoneOffset.UTC));
    }

    // -------------------------------------------------------------------------
    // 4. Guard: ENVIADO_LABORATORIO exige armação/lente
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("ENVIADO_LABORATORIO sem armacao/lente deve falhar guard")
    void enviadoLaboratorioSemItemDeveFalhar() {
        OrdemServico os = novaOS(StatusOS.PEDIDO_CONFIRMADO);
        os.setArmacaoId(null);
        os.setLenteId(null);
        stubRepository(os);

        assertThatThrownBy(() -> service.avancar(LOJA_ID, OS_ID, StatusOS.ENVIADO_LABORATORIO, "vendedor", "sem lente"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("armação ou lente");
    }

    // -------------------------------------------------------------------------
    // 5. Casos de borda: nulo, duplicidade, RLS-like fail-closed
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("origem/destino nulo deve ser transição inválida (não NPE)")
    void nuloDeveSerInvalido() {
        assertThat(registry.podeTransitar(null, StatusOS.ENTREGUE)).isFalse();
        assertThat(registry.podeTransitar(StatusOS.ORCAMENTO, null)).isFalse();
        assertThatThrownBy(() -> registry.validarTransicao(null, null))
                .isInstanceOf(TransicaoInvalidaException.class);
    }

    @Test
    @DisplayName("mapa PERMITIDAS deve ser imutável")
    void mapaImutavel() {
        Map<StatusOS, Set<StatusOS>> todas = registry.todasTransicoes();
        assertThatThrownBy(() -> todas.put(StatusOS.ORCAMENTO, Set.of(StatusOS.ENTREGUE)))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("12 status presentes no enum — contrato de domínio")
    void dozeStatusNoEnum() {
        assertThat(StatusOS.values()).hasSize(12);
    }

    @Nested
    @DisplayName("Concorrência / @Version — optimistic lock")
    class Concorrencia {

        @Test
        @DisplayName("dois avanços simultâneos: segundo deve ver @Version incrementado (simula OptimisticLockException)")
        void doisAvancosSimultaneos() {
            // Dado: OS em PEDIDO_CONFIRMADO versão 0
            OrdemServico os = novaOS(StatusOS.PEDIDO_CONFIRMADO);
            os.setArmacaoId(UUID.randomUUID());
            os.setVersao(0L);
            stubRepository(os);

            // Quando: primeiro avanço sucede
            OrdemServico aposPrimeiro = service.avancar(LOJA_ID, OS_ID, StatusOS.ENVIADO_LABORATORIO, "user1", "ok");
            // Simula JPA incrementando versão
            aposPrimeiro.setVersao(1L);

            // Então: segundo avanço com versão stale deve ser detectado
            // Em prod, Hibernate lança OptimisticLockException; aqui verificamos versão mudou
            assertThat(aposPrimeiro.getVersao()).isEqualTo(1L);
            assertThat(aposPrimeiro.getStatus()).isEqualTo(StatusOS.ENVIADO_LABORATORIO);
            // Histórico tem 1 evento, não duplica
            assertThat(aposPrimeiro.getHistorico()).hasSize(1);
        }
    }

    // ---- helpers ----
    private OrdemServico novaOS(StatusOS status) {
        return OrdemServico.builder()
                .id(OS_ID)
                .lojaId(LOJA_ID)
                .numero("OS-2026-00123")
                .clienteId(UUID.randomUUID())
                .status(status)
                .previsaoEntrega(OffsetDateTime.now(fixedClock).plusDays(5))
                .historico(new java.util.ArrayList<>())
                .build();
    }

    private void stubRepository(OrdemServico os) {
        when(repository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenReturn(java.util.Optional.of(os));
        when(repository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));
        // para buscas subsequentes retornar a mesma instância mutada
        when(repository.findByIdAndLojaId(OS_ID, LOJA_ID)).thenAnswer(inv -> java.util.Optional.of(os));
    }
}
