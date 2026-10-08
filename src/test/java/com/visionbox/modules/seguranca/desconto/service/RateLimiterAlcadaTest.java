package com.visionbox.modules.seguranca.desconto.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterAlcadaTest {

    private static final String CHAVE = "loja:usuario";

    private ManualClock clock;
    private RateLimiterAlcada limiter;

    @BeforeEach
    void setUp() {
        clock = new ManualClock(Instant.parse("2026-10-08T10:00:00Z"));
        limiter = new RateLimiterAlcada(5, 15, clock);
    }

    @Test
    @DisplayName("Somente bloqueia ao atingir o número máximo de falhas na janela")
    void bloqueiaAposMaxTentativas() {
        for (int i = 1; i <= 4; i++) {
            limiter.registrarFalha(CHAVE);
            assertThat(limiter.excedeuLimite(CHAVE))
                    .as("falha %d ainda não deve bloquear", i)
                    .isFalse();
        }
        limiter.registrarFalha(CHAVE);
        assertThat(limiter.excedeuLimite(CHAVE)).isTrue();
    }

    @Test
    @DisplayName("Sucesso zera o contador da chave")
    void sucessoZeraContador() {
        for (int i = 0; i < 5; i++) {
            limiter.registrarFalha(CHAVE);
        }
        assertThat(limiter.excedeuLimite(CHAVE)).isTrue();

        limiter.registrarSucesso(CHAVE);

        assertThat(limiter.excedeuLimite(CHAVE)).isFalse();
    }

    @Test
    @DisplayName("Janela expirada libera automaticamente")
    void janelaExpiradaLibera() {
        for (int i = 0; i < 5; i++) {
            limiter.registrarFalha(CHAVE);
        }
        assertThat(limiter.excedeuLimite(CHAVE)).isTrue();

        // antes do fim da janela ainda bloqueia
        clock.avancar(Duration.ofMinutes(14));
        assertThat(limiter.excedeuLimite(CHAVE)).isTrue();

        // no fim da janela libera (lazy): janela é reaberta na próxima falha
        clock.avancar(Duration.ofMinutes(1));
        assertThat(limiter.excedeuLimite(CHAVE)).isFalse();

        limiter.registrarFalha(CHAVE);
        assertThat(limiter.excedeuLimite(CHAVE)).isFalse(); // janela recomeçou
    }

    @Test
    @DisplayName("Chaves são independentes (usuário A não bloqueia usuário B)")
    void chavesSaoIndependentes() {
        limiter.registrarFalha("loja:usuario-a");
        for (int i = 0; i < 5; i++) {
            limiter.registrarFalha("loja:usuario-b");
        }
        assertThat(limiter.excedeuLimite("loja:usuario-a")).isFalse();
        assertThat(limiter.excedeuLimite("loja:usuario-b")).isTrue();
    }

    /** Clock mutável para testes de janela — sem depender de sleep. */
    private static final class ManualClock extends Clock {

        private Instant agora;

        ManualClock(Instant agora) {
            this.agora = agora;
        }

        void avancar(Duration duracao) {
            agora = agora.plus(duracao);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public long millis() {
            return agora.toEpochMilli();
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }
}