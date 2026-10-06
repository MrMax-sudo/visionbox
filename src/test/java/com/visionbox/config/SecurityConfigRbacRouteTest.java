package com.visionbox.config;

import com.visionbox.shared.tenant.TenantFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.util.stream.Stream;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = SecurityConfigRbacRouteTest.TestApplication.class)
@AutoConfigureMockMvc
class SecurityConfigRbacRouteTest {

    private static final String LOJA_ID = "00000000-0000-0000-0000-000000000001";

    @Autowired
    private MockMvc mockMvc;

    @ParameterizedTest(name = "{0} nao deve acessar {2} {1}")
    @MethodSource("forbiddenRoutesByPerfil")
    @DisplayName("perfis indevidos recebem 403 nas rotas sensíveis")
    void perfisIndevidosRecebemForbidden(String perfil, String method, String path) throws Exception {
        request(method, path, perfil).andExpect(status().isForbidden());
    }

    @ParameterizedTest(name = "{0} deve acessar {2} {1}")
    @MethodSource("allowedRoutesByPerfil")
    @DisplayName("perfil permitido chega ao controller de prova")
    void perfisPermitidosChegamAoController(String perfil, String method, String path) throws Exception {
        request(method, path, perfil).andExpect(status().isNoContent());
    }

    private org.springframework.test.web.servlet.ResultActions request(String method, String path, String perfil) throws Exception {
        var builder = "POST".equals(method) ? post(path) : get(path);
        return mockMvc.perform(builder.with(jwt()
                .jwt(jwt -> jwt
                        .subject(UUID.randomUUID().toString())
                        .claim("loja_id", LOJA_ID)
                        .claim("perfil", perfil))
                .authorities(new SimpleGrantedAuthority("ROLE_" + perfil))));
    }

    private static Stream<Arguments> forbiddenRoutesByPerfil() {
        return Stream.of(
                Arguments.of("VENDEDOR", "GET", "/api/v1/usuarios"),
                Arguments.of("GERENTE", "GET", "/api/v1/usuarios"),
                Arguments.of("FINANCEIRO", "GET", "/api/v1/usuarios"),
                Arguments.of("LABORATORIO", "GET", "/api/v1/usuarios"),

                Arguments.of("VENDEDOR", "GET", "/api/v1/financeiro/contas-receber"),
                Arguments.of("OTICO", "GET", "/api/v1/financeiro/dre"),
                Arguments.of("TECNICO", "POST", "/api/v1/financeiro/contas-pagar"),
                Arguments.of("LABORATORIO", "GET", "/api/v1/financeiro/contas-receber"),

                Arguments.of("VENDEDOR", "POST", "/api/v1/fiscal/nfce/emitir"),
                Arguments.of("OTICO", "POST", "/api/v1/fiscal/nfce/emitir"),
                Arguments.of("TECNICO", "POST", "/api/v1/fiscal/nfce/emitir"),
                Arguments.of("LABORATORIO", "POST", "/api/v1/fiscal/nfce/emitir"),

                Arguments.of("FINANCEIRO", "GET", "/api/v1/receitas"),
                Arguments.of("TECNICO", "GET", "/api/v1/receitas"),
                Arguments.of("LABORATORIO", "POST", "/api/v1/receitas"),

                Arguments.of("VENDEDOR", "POST", "/api/v1/laboratorios/portal-tokens"),
                Arguments.of("OTICO", "POST", "/api/v1/laboratorios/portal-tokens"),
                Arguments.of("FINANCEIRO", "POST", "/api/v1/laboratorios/portal-tokens")
        );
    }

    private static Stream<Arguments> allowedRoutesByPerfil() {
        return Stream.of(
                Arguments.of("ADMIN", "GET", "/api/v1/usuarios"),
                Arguments.of("FINANCEIRO", "GET", "/api/v1/financeiro/contas-receber"),
                Arguments.of("GERENTE", "POST", "/api/v1/fiscal/nfce/emitir"),
                Arguments.of("OTICO", "GET", "/api/v1/receitas"),
                Arguments.of("LABORATORIO", "POST", "/api/v1/laboratorios/portal-tokens")
        );
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration(exclude = {
            DataSourceAutoConfiguration.class,
            HibernateJpaAutoConfiguration.class,
            FlywayAutoConfiguration.class,
            RedisAutoConfiguration.class,
            RabbitAutoConfiguration.class
    })
    @Import({SecurityConfig.class, JwtConfig.class, TenantFilter.class, RouteProbeController.class})
    static class TestApplication {
    }

    @RestController
    static class RouteProbeController {

        @GetMapping("/api/v1/usuarios")
        ResponseEntity<Void> usuarios() {
            return ResponseEntity.noContent().build();
        }

        @RequestMapping("/api/v1/financeiro/contas-receber")
        ResponseEntity<Void> contasReceber() {
            return ResponseEntity.noContent().build();
        }

        @RequestMapping("/api/v1/financeiro/contas-pagar")
        ResponseEntity<Void> contasPagar() {
            return ResponseEntity.noContent().build();
        }

        @GetMapping("/api/v1/financeiro/dre")
        ResponseEntity<Void> dre() {
            return ResponseEntity.noContent().build();
        }

        @PostMapping("/api/v1/fiscal/nfce/emitir")
        ResponseEntity<Void> emitirNfce() {
            return ResponseEntity.noContent().build();
        }

        @RequestMapping("/api/v1/receitas")
        ResponseEntity<Void> receitas() {
            return ResponseEntity.noContent().build();
        }

        @PostMapping("/api/v1/laboratorios/portal-tokens")
        ResponseEntity<Void> labPortalTokens() {
            return ResponseEntity.noContent().build();
        }
    }
}
