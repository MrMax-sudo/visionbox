package com.visionbox.config;

import com.visionbox.shared.tenant.TenantFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.crypto.SecretKey;
import java.util.Collection;
import java.util.List;

/**
 * SecurityConfig S0 — JWT stateless, 15m access / 7d refresh httpOnly (ADR-003).
 * S0 libera tudo exceto autenticação real; S0-03 fecha com JwtDecoder + RBAC matrix.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableTransactionManagement(order = Ordered.HIGHEST_PRECEDENCE)
public class SecurityConfig {

    @Bean
    public JwtDecoder jwtDecoder(javax.crypto.SecretKey jwtSecretKey) {
        return NimbusJwtDecoder.withSecretKey(jwtSecretKey).build();
    }

    @Bean
    public FilterRegistrationBean<TenantFilter> tenantFilterRegistration(TenantFilter tenantFilter) {
        FilterRegistrationBean<TenantFilter> registration = new FilterRegistrationBean<>(tenantFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new PerfilAuthoritiesConverter());
        return converter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           TenantFilter tenantFilter,
                                           JwtAuthenticationConverter jwtAuthenticationConverter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/actuator/**",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/api/auth/**",
                                "/api/v1/auth/**",
                                "/api/v1/ordens-servico/rastreio",
                                "/api/v1/ordens-servico/rastreio/**",
                                "/api/v1/laboratorios/portal/**",
                                "/error"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/empresa/**").authenticated()
                        .requestMatchers("/api/v1/empresa/**").hasAnyRole("ADMIN", "GERENTE", "DESENVOLVEDOR")
                        .requestMatchers("/api/v1/dev/**").hasAnyRole("ADMIN", "DESENVOLVEDOR")
                        .requestMatchers("/api/v1/usuarios/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/caixa/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR", "FINANCEIRO")
                        .requestMatchers("/api/v1/financeiro/**").hasAnyRole("ADMIN", "GERENTE", "FINANCEIRO")
                        .requestMatchers("/api/v1/fiscal/**").hasAnyRole("ADMIN", "GERENTE", "FINANCEIRO")
                        .requestMatchers("/api/v1/receitas/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR", "OTICO")
                        .requestMatchers("/api/v1/crm/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR")
                        .requestMatchers("/api/v1/estoque/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR", "TECNICO")
                        .requestMatchers("/api/v1/laboratorios/**").hasAnyRole("ADMIN", "GERENTE", "TECNICO", "LABORATORIO")
                        .requestMatchers("/api/v1/produtos/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR", "OTICO", "TECNICO")
                        .requestMatchers("/api/v1/clientes/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR", "OTICO")
                        .requestMatchers("/api/v1/ordens-servico/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR", "OTICO", "TECNICO", "LABORATORIO")
                        .requestMatchers("/api/v1/vendas/**").hasAnyRole("ADMIN", "GERENTE", "VENDEDOR")
                        .requestMatchers("/api/v1/relatorios/**").hasAnyRole("ADMIN", "GERENTE", "FINANCEIRO")
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)))
                .addFilterAfter(tenantFilter, BearerTokenAuthenticationFilter.class)
                .headers(h -> h.frameOptions(f -> f.disable()));
        return http.build();
    }

    static class PerfilAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {
        @Override
        public Collection<GrantedAuthority> convert(Jwt jwt) {
            String perfil = jwt.getClaimAsString("perfil");
            if (perfil == null || perfil.isBlank()) {
                return List.of();
            }
            return List.of(new SimpleGrantedAuthority("ROLE_" + perfil.trim().toUpperCase()));
        }
    }
}
