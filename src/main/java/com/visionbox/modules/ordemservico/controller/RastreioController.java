package com.visionbox.modules.ordemservico.controller;

import com.visionbox.modules.ordemservico.dto.RastreioBuscaResponse;
import com.visionbox.modules.ordemservico.dto.RastreioResponse;
import com.visionbox.modules.ordemservico.service.RastreioService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.Optional;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/v1/ordens-servico/rastreio")
@RequiredArgsConstructor
public class RastreioController {

    private final RastreioService service;

    private Counter rastreioBuscaTotal;

    @PostConstruct
    public void init(MeterRegistry registry) {
        this.rastreioBuscaTotal = registry.counter("visionbox_rastreio_busca_total");
    }

    @PreDestroy
    public void cleanup() {
        this.rastreioBuscaTotal = null;
    }

    /**
     * Busca OS pelo número em todas as lojas e devolve link de rastreio (token + payload).
     * Endpoint público: GET /api/v1/ordens-servico/rastreio?numero=OS-12345
     */
    @GetMapping
    public ResponseEntity<RastreioBuscaResponse> buscarPorNumero(@RequestParam("numero") String numero) {
        rastreioBuscaTotal.increment();
        RastreioBuscaResponse resp = service.buscarPorNumero(numero);
        return ResponseEntity.ok(resp);
    }

    /**
     * Busca OS pelo token assinado (HMAC opaco).
     * Endpoint público: GET /api/v1/ordens-servico/rastreio/{token}
     * Token contém lojaId+ordemServicoId+exp (vence após TTL — HTTP 410 se expirado).
     */
    @GetMapping("/{token}")
    public ResponseEntity<RastreioResponse> buscarPorToken(@PathVariable String token) {
        RastreioResponse resp = service.buscarPorToken(token);
        return ResponseEntity.ok(resp);
    }
}