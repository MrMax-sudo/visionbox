package com.visionbox.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Jackson — OffsetDateTime timestamptz + não escrever datas como timestamp.
 * <p>
 * ATENÇÃO: este {@code @Bean} substitui o {@code ObjectMapper} do auto-config do Spring Boot,
 * portanto as propriedades {@code spring.jackson.*} do application.yml NÃO são aplicadas
 * automaticamente (o converter {@code MappingJackson2HttpMessageConverter} injeta exatamente
 * este bean). Por isso as features precisam ser configuradas aqui explicitamente.
 * <p>
 * {@code FAIL_ON_UNKNOWN_PROPERTIES} desabilitado para casar com
 * {@code spring.jackson.deserialization.fail-on-unknown-properties=false} — sem isso, qualquer
 * campo extra enviado pelo frontend (ex.: {@code tipoLente} em /receitas) virava
 * 400 "Corpo da requisição inválido ou JSON malformado.".
 */
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.disable(SerializationFeature.WRITE_DURATIONS_AS_TIMESTAMPS);
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        return mapper;
    }
}
