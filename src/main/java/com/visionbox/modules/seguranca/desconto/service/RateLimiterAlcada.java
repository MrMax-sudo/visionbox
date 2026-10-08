package com.visionbox.modules.seguranca.desconto.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Limitador EM MEMÓRIA (janela fixa) para o endpoint de alçada de desconto (P7).
 * <p>
 * Propositalmente sem Redis/externo: a instrução de P7 é não assumir Redis
 * disponível e o endpoint tem volume baixo (5 tentativas/15 min) — um mapa
 * thread-safe por chave {@code lojaId:usuarioId} é suficiente e não adiciona
 * latência de rede a uma operação de PDV.
 * <p>
 * Semântica:
 * <ul>
 *   <li>janela fixa de 15 minutos iniciada na PRIMEIRA falha;</li>
 *   <li>{@link #excedeuLimite} bloqueia quando as falhas na janela alcançam
 *       {@code maxTentativas};</li>
 *   <li>{@link #registrarSucesso} zera o contador (PIN correto reabre a janela);</li>
 *   <li>janela expirada libera automaticamente (contadores são "lazy" — expiram
 *       ao serem consultados/atualizados, sem job de limpeza).</li>
 * </ul>
 * Config: {@code visionbox.alcada.rate-limit-max-tentativas} (default 5) e
 * {@code visionbox.alcada.rate-limit-janela-minutos} (default 15).
 */
@Component
public class RateLimiterAlcada {

    private final int maxTentativas;
    private final Duration janela;
    private final Clock clock;
    private final Map<String, Contador> contadores = new HashMap<>();

    public RateLimiterAlcada(
            @Value("${visionbox.alcada.rate-limit-max-tentativas:5}") int maxTentativas,
            @Value("${visionbox.alcada.rate-limit-janela-minutos:15}") long janelaMinutos,
            Clock clock) {
        if (maxTentativas <= 0) {
            throw new IllegalArgumentException("maxTentativas deve ser positivo");
        }
        if (janelaMinutos <= 0) {
            throw new IllegalArgumentException("janelaMinutos deve ser positivo");
        }
        this.maxTentativas = maxTentativas;
        this.janela = Duration.ofMinutes(janelaMinutos);
        this.clock = clock;
    }

    /**
     * @return {@code true} quando a chave já estourou as tentativas na janela atual.
     */
    public synchronized boolean excedeuLimite(String chave) {
        Contador atual = contadores.get(chave);
        if (atual == null) {
            return false;
        }
        if (atual.expirado(clock.instant(), janela)) {
            contadores.remove(chave);
            return false;
        }
        return atual.falhas() >= maxTentativas;
    }

    /**
     * Contabiliza uma falha (PIN não conferiu). Janela recomeça na primeira falha
     * e conta a partir daí.
     */
    public synchronized void registrarFalha(String chave) {
        Instant agora = clock.instant();
        contadores.compute(chave, (k, atual) -> {
            if (atual == null || atual.expirado(agora, janela)) {
                return new Contador(agora, 1);
            }
            return new Contador(atual.inicio(), atual.falhas() + 1);
        });
    }

    /** Sucesso na validação zera o contador da chave. */
    public synchronized void registrarSucesso(String chave) {
        contadores.remove(chave);
    }

    /** Apenas para testes — limpa o estado global do bean. */
    public synchronized void reset() {
        contadores.clear();
    }

    private record Contador(Instant inicio, int falhas) {
        boolean expirado(Instant agora, Duration janela) {
            return !inicio.plus(janela).isAfter(agora);
        }
    }
}