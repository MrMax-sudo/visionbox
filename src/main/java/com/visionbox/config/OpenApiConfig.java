package com.visionbox.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 — springdoc 2.6.x.
 * Expõe /v3/api-docs e /swagger-ui.html. S0 exige springdoc 2.6.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI visionBoxOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("VisionBox API")
                        .description("ERP vertical para óticas — família TECHBOXBR. Multi-tenant por loja_id.")
                        .version("0.1.0-S0"))
                .components(new Components()
                        .addSecuritySchemes("bearer-jwt", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT access 15m. Envie Authorization: Bearer <token> + X-Loja-Id")))
                .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }
}
