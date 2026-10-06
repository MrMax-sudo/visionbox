package com.visionbox.shared.tenant;

import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Prova ADR-001 com PostgreSQL real:
 * RLS FORCE isola dados quando a aplicacao roda como app_api e TenantRlsAspect
 * seta app.loja_id dentro da transacao.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@DisplayName("Isolamento Tenant — RLS FORCE real com app.loja_id")
class IsolamentoTenantTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("visionbox_test")
            .withUsername("visionbox")
            .withPassword("visionbox")
            .withReuse(true);

    @DynamicPropertySource
    static void pgProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.autoconfigure.exclude", () -> "org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration,org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration");
    }

    private static final UUID LOJA_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID LOJA_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID CLIENTE_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-000000000001");
    private static final UUID CLIENTE_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-000000000001");

    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @Autowired RlsProbeService rlsProbeService;

    @BeforeEach
    void seedMultiTenant() {
        jdbc.execute("SET row_security = off");
        jdbc.execute("DELETE FROM receita");
        jdbc.execute("DELETE FROM cliente");
        jdbc.execute("DELETE FROM loja WHERE id IN ('" + LOJA_A + "', '" + LOJA_B + "')");
        jdbc.update("INSERT INTO loja(id, nome, cnpj) VALUES (?, ?, ?)", LOJA_A, "Otica Centro A", "11111111000111");
        jdbc.update("INSERT INTO loja(id, nome, cnpj) VALUES (?, ?, ?)", LOJA_B, "Otica Centro B", "22222222000122");
        jdbc.update("""
                INSERT INTO cliente(id, loja_id, nome, cpf_hash, telefone, ativo, criado_em, atualizado_em, versao)
                VALUES (?, ?, ?, ?, ?, true, now(), now(), 0)
                """, CLIENTE_A, LOJA_A, "Maria Silva", "hash-cpf-loja-a", "11999999999");
        jdbc.update("""
                INSERT INTO cliente(id, loja_id, nome, cpf_hash, telefone, ativo, criado_em, atualizado_em, versao)
                VALUES (?, ?, ?, ?, ?, true, now(), now(), 0)
                """, CLIENTE_B, LOJA_B, "Joao Souza", "hash-cpf-loja-b", "21999999999");
        jdbc.execute("RESET row_security");
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Migration V11 deve habilitar RLS FORCE e policy loja_isolation em cliente")
    void migrationDeveHabilitarRlsForceEmCliente() {
        RlsMetadata metadata = jdbc.queryForObject("""
                SELECT c.relrowsecurity, c.relforcerowsecurity, count(p.policyname)
                  FROM pg_class c
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                  LEFT JOIN pg_policies p
                    ON p.schemaname = n.nspname
                   AND p.tablename = c.relname
                   AND p.policyname = 'loja_isolation'
                 WHERE n.nspname = 'public'
                   AND c.relname = 'cliente'
                 GROUP BY c.relrowsecurity, c.relforcerowsecurity
                """, (rs, rowNum) -> new RlsMetadata(rs.getBoolean(1), rs.getBoolean(2), rs.getInt(3)));

        assertThat(metadata).isNotNull();
        assertThat(metadata.rlsEnabled()).isTrue();
        assertThat(metadata.rlsForced()).isTrue();
        assertThat(metadata.policyCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("app_api sem app.loja_id deve falhar fechado e nao enxergar clientes")
    void appApiSemGucDeveFalharFechado() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            statement.execute("SET LOCAL ROLE app_api");
            statement.execute("SET LOCAL row_security = on");

            ResultSet rs = statement.executeQuery("SELECT count(*) FROM cliente");
            assertThat(rs.next()).isTrue();
            assertThat(rs.getInt(1)).isZero();

            connection.rollback();
        }
    }

    @Test
    @DisplayName("app_api com app.loja_id deve enxergar somente a loja da GUC")
    void appApiComGucDeveIsolarPorLoja() throws Exception {
        assertThat(countClientesComoAppApi(LOJA_A)).isEqualTo(1);
        assertThat(nomesClientesComoAppApi(LOJA_A)).containsExactly("Maria Silva");

        assertThat(countClientesComoAppApi(LOJA_B)).isEqualTo(1);
        assertThat(nomesClientesComoAppApi(LOJA_B)).containsExactly("Joao Souza");
    }

    @Test
    @DisplayName("WITH CHECK deve bloquear insert cross-tenant mesmo com SQL direto")
    void appApiNaoPodeInserirClienteDeOutroTenant() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            statement.execute("SET LOCAL ROLE app_api");
            statement.execute("SET LOCAL row_security = on");
            statement.execute("SELECT set_config('app.loja_id', '" + LOJA_A + "', true)");

            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO cliente(loja_id, nome, cpf_hash, ativo, criado_em, atualizado_em, versao)
                    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cross Tenant', 'hash-cross', true, now(), now(), 0)
                    """))
                    .hasMessageContaining("violates row-level security policy");

            connection.rollback();
        }
    }

    @Test
    @DisplayName("TenantRlsAspect deve setar app.loja_id dentro de metodo @Transactional")
    void tenantRlsAspectDeveSetarGucNaTransacao() {
        TenantContext.setCurrentLojaId(LOJA_A);

        RlsProbe probeA = rlsProbeService.probeComoAppApi();

        assertThat(probeA.currentSetting()).isEqualTo(LOJA_A.toString());
        assertThat(probeA.currentLojaId()).isEqualTo(LOJA_A);
        assertThat(probeA.countSemWhere()).isEqualTo(1);
        assertThat(probeA.repositoryNames()).containsExactly("Maria Silva");

        TenantContext.setCurrentLojaId(LOJA_B);
        RlsProbe probeB = rlsProbeService.probeComoAppApi();

        assertThat(probeB.currentSetting()).isEqualTo(LOJA_B.toString());
        assertThat(probeB.currentLojaId()).isEqualTo(LOJA_B);
        assertThat(probeB.countSemWhere()).isEqualTo(1);
        assertThat(probeB.repositoryNames()).containsExactly("Joao Souza");
    }

    @Test
    @DisplayName("TenantContext sem loja_id continua fail-closed na aplicacao")
    void tenantContextSemLojaDeveFalharFechado() {
        TenantContext.clear();

        assertThat(TenantContext.getCurrentLojaId()).isEmpty();
        assertThatThrownBy(TenantContext::requireCurrentLojaId)
                .isInstanceOf(IllegalStateException.class);
    }

    private int countClientesComoAppApi(UUID lojaId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            statement.execute("SET LOCAL ROLE app_api");
            statement.execute("SET LOCAL row_security = on");
            statement.execute("SELECT set_config('app.loja_id', '" + lojaId + "', true)");
            ResultSet rs = statement.executeQuery("SELECT count(*) FROM cliente");
            assertThat(rs.next()).isTrue();
            int count = rs.getInt(1);
            connection.rollback();
            return count;
        }
    }

    private List<String> nomesClientesComoAppApi(UUID lojaId) throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            statement.execute("SET LOCAL ROLE app_api");
            statement.execute("SET LOCAL row_security = on");
            statement.execute("SELECT set_config('app.loja_id', '" + lojaId + "', true)");
            ResultSet rs = statement.executeQuery("SELECT nome FROM cliente ORDER BY nome");
            java.util.ArrayList<String> nomes = new java.util.ArrayList<>();
            while (rs.next()) {
                nomes.add(rs.getString(1));
            }
            connection.rollback();
            return nomes;
        }
    }

    record RlsMetadata(boolean rlsEnabled, boolean rlsForced, int policyCount) {}

    record RlsProbe(String currentSetting, UUID currentLojaId, int countSemWhere, List<String> repositoryNames) {}

    @TestConfiguration
    static class RlsProbeTestConfig {
        @Bean
        RlsProbeService rlsProbeService(ClienteRepository clienteRepository) {
            return new RlsProbeService(clienteRepository);
        }
    }

    static class RlsProbeService {
        private final ClienteRepository clienteRepository;

        @PersistenceContext
        private EntityManager entityManager;

        RlsProbeService(ClienteRepository clienteRepository) {
            this.clienteRepository = clienteRepository;
        }

        @Transactional(readOnly = true)
        RlsProbe probeComoAppApi() {
            entityManager.createNativeQuery("SET LOCAL ROLE app_api").executeUpdate();
            entityManager.createNativeQuery("SET LOCAL row_security = on").executeUpdate();

            String currentSetting = (String) entityManager
                    .createNativeQuery("SELECT current_setting('app.loja_id', true)")
                    .getSingleResult();
            UUID currentLojaId = (UUID) entityManager
                    .createNativeQuery("SELECT app.current_loja_id()")
                    .getSingleResult();
            Number countSemWhere = (Number) entityManager
                    .createNativeQuery("SELECT count(*) FROM cliente")
                    .getSingleResult();
            List<String> repositoryNames = clienteRepository.findAllByLojaId(TenantContext.requireCurrentLojaId())
                    .stream()
                    .map(Cliente::getNome)
                    .sorted()
                    .toList();

            return new RlsProbe(currentSetting, currentLojaId, countSemWhere.intValue(), repositoryNames);
        }
    }
}
