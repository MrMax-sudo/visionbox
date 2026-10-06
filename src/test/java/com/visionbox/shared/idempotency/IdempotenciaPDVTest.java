package com.visionbox.shared.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.vendas.dto.PedidoVendaRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Idempotência PDV — DoD GOVERNANCE.md §5: "teste idempotência se for PDV"
 * + arquivo.md §13: outbox + Idempotency-Key UUID UNIQUE(loja_id,key) TTL 24h.
 *
 * Esqueleto compilável com fluxos críticos: header, replay, concorrência duplo clique.
 * Usa MockMvc + Testcontainers PG + Awaitility para outbox.
 * Canônico: IdempotencyKey (UNIQUE loja_id,chave) + IdempotencyFilter + TenantContext.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Idempotência PDV — header Idempotency-Key (outbox offline)")
class IdempotenciaPDVTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("visionbox_test_idemp")
            .withUsername("visionbox")
            .withPassword("visionbox")
            .withReuse(true);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired IdempotencyRepository idempotencyRepository;

    private static final UUID LOJA_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private String payloadJson;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.execute("DELETE FROM idempotency_key");
        jdbc.execute("DELETE FROM loja WHERE id = '" + LOJA_ID + "'");
        jdbc.update("INSERT INTO loja(id,nome,cnpj) VALUES (?,?,?) ON CONFLICT (id) DO NOTHING",
                LOJA_ID, "Ótica Teste PDV", "99.999.999/0001-99");

        PedidoVendaRequest req = PedidoVendaRequest.builder()
                .clienteNome("Maria Teste")
                .clienteId(UUID.randomUUID())
                .itens(List.of(PedidoVendaRequest.ItemRequest.builder()
                        .sku("ARMA-001")
                        .quantidade(1)
                        .precoUnitario("299.90")
                        .build()))
                .observacao("PDV smoke")
                .build();
        payloadJson = objectMapper.writeValueAsString(req);
    }

    @Nested
    @DisplayName("Header Idempotency-Key — contrato PDV")
    class HeaderContrato {

        @Test
        @DisplayName("POST sem header deve criar (201) — offline gera UUID client-side")
        void semHeaderDeveCriar201() throws Exception {
            mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("POST com Idempotency-Key deve retornar 201 na primeira vez")
        void comHeaderPrimeiraVez201() throws Exception {
            String key = UUID.randomUUID().toString();

            MvcResult result = mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated())
                    .andReturn();

            await().atMost(Duration.ofSeconds(2)).untilAsserted(() ->
                    assertThat(idempotencyRepository.findByLojaIdAndChave(LOJA_ID, key)).isPresent()
            );
            // filter replay header só no segundo POST
            assertThat(result.getResponse().getHeader("Idempotent-Replayed")).isNull();
        }

        @Test
        @DisplayName("Duplo POST mesma Idempotency-Key mesma loja deve criar 1 venda (segundo é replay)")
        void duploPostMesmaKeyDeveSerIdempotente() throws Exception {
            String key = UUID.randomUUID().toString();

            MvcResult r1 = mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated())
                    .andReturn();
            String body1 = r1.getResponse().getContentAsString();

            MvcResult r2 = mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated())
                    .andExpect(header().string("Idempotent-Replayed", "true"))
                    .andReturn();
            String body2 = r2.getResponse().getContentAsString();

            assertThat(body1).isEqualTo(body2);
            assertThat(idempotencyRepository.findByLojaIdAndChave(LOJA_ID, key)).isPresent();
            Integer count = jdbc.queryForObject("SELECT count(*) FROM idempotency_key WHERE chave = ?", Integer.class, key);
            assertThat(count).isEqualTo(1);
        }

        @Test
        @DisplayName("Mesma Idempotency-Key em lojas diferentes não colide (UNIQUE loja_id,chave)")
        void mesmaKeyLojasDiferentesNaoColide() throws Exception {
            String key = UUID.randomUUID().toString();
            UUID lojaB = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
            jdbc.update("INSERT INTO loja(id,nome,cnpj) VALUES (?,?,?) ON CONFLICT (id) DO NOTHING",
                    lojaB, "Loja B", "88.888.888/0001-88");

            mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated());

            mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", lojaB.toString())
                            .header("Idempotency-Key", key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated())
                    .andExpect(header().doesNotExist("Idempotent-Replayed"));

            assertThat(jdbc.queryForObject("SELECT count(*) FROM idempotency_key WHERE chave = ?", Integer.class, key)).isEqualTo(2);
        }

        @Test
        @DisplayName("Idempotency-Key vazia trata como sem idempotência (cria nova)")
        void formatoKeyValidacao() throws Exception {
            mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", "")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated());

            mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", "   ")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated());
        }
    }

    @Nested
    @DisplayName("Concorrência — duplo clique PDV (outbox race)")
    class Concorrencia {

        @Test
        @DisplayName("5 requests concorrentes mesma key devem resultar em 1 registro (race protegido por UNIQUE)")
        void concorrenciaDuploClique() throws Exception {
            String key = UUID.randomUUID().toString();
            int threads = 5;
            ExecutorService pool = Executors.newFixedThreadPool(threads);
            CountDownLatch start = new CountDownLatch(1);

            List<Future<Integer>> futures = java.util.stream.IntStream.range(0, threads)
                    .mapToObj(i -> pool.submit(() -> {
                        start.await();
                        try {
                            MvcResult r = mockMvc.perform(post("/api/v1/vendas")
                                            .header("X-Loja-Id", LOJA_ID.toString())
                                            .header("Idempotency-Key", key)
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content(payloadJson))
                                    .andReturn();
                            return r.getResponse().getStatus();
                        } catch (Exception e) {
                            return 500;
                        }
                    }))
                    .toList();

            start.countDown();
            pool.shutdown();
            boolean terminated = pool.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(terminated).isTrue();

            for (Future<Integer> f : futures) {
                int st = f.get();
                assertThat(st).isIn(201, 409); // primeiro 201, race 409 ou replay 201
            }

            await().atMost(Duration.ofSeconds(2)).untilAsserted(() ->
                    assertThat(jdbc.queryForObject("SELECT count(*) FROM idempotency_key WHERE chave = ?", Integer.class, key)).isEqualTo(1)
            );
        }
    }

    @Nested
    @DisplayName("Outbox / TTL — Awaitility")
    class Outbox {

        @Test
        @DisplayName("Venda idempotente deve persistir idempotency_key e ser visível via awaitility")
        void outboxPendenteParaEnviado() throws Exception {
            String key = UUID.randomUUID().toString();
            mockMvc.perform(post("/api/v1/vendas")
                            .header("X-Loja-Id", LOJA_ID.toString())
                            .header("Idempotency-Key", key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payloadJson))
                    .andExpect(status().isCreated());

            await().atMost(Duration.ofSeconds(3))
                    .pollInterval(Duration.ofMillis(100))
                    .untilAsserted(() -> {
                        Integer c = jdbc.queryForObject("SELECT count(*) FROM idempotency_key WHERE loja_id = ?", Integer.class, LOJA_ID);
                        assertThat(c).isGreaterThanOrEqualTo(1);
                    });
        }

        @Test
        @DisplayName("TTL 24h — registro expirado deve ser considerado expirado (dado sujo)")
        void ttl24hExpiracao() {
            IdempotencyKey expirado = IdempotencyKey.builder()
                    .lojaId(LOJA_ID)
                    .chave("expired-key-" + UUID.randomUUID())
                    .metodo("POST")
                    .path("/api/v1/vendas")
                    .statusCode(201)
                    .responseBody("{\"id\":\"old\"}")
                    .expiraEm(OffsetDateTime.now().minusHours(1))
                    .build();
            idempotencyRepository.save(expirado);

            var found = idempotencyRepository.findByLojaIdAndChave(LOJA_ID, expirado.getChave());
            assertThat(found).isPresent();
            assertThat(found.get().isExpirado()).isTrue();

            // simula filter limpando expirado
            if (found.get().isExpirado()) {
                idempotencyRepository.delete(found.get());
            }
            assertThat(idempotencyRepository.findByLojaIdAndChave(LOJA_ID, expirado.getChave())).isEmpty();
        }
    }
}
