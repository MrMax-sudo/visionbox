package com.visionbox.modules.clinico.controller;

import com.visionbox.modules.clinico.dto.ReceitaRequest;
import com.visionbox.modules.clinico.dto.ReceitaResponse;
import com.visionbox.modules.clinico.service.ReceitaService;
import com.visionbox.shared.tenant.TenantContext;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/receitas")
@RequiredArgsConstructor
public class ReceitaController {

    private final ReceitaService service;
    private final MeterRegistry meterRegistry;

    @GetMapping
    public Page<ReceitaResponse> listar(@RequestParam(required = false) UUID clienteId,
                                        @PageableDefault(size = 20) Pageable pageable) {
        registrarLeituraReceita();
        return service.listar(clienteId, pageable);
    }

    @GetMapping("/{id}")
    public ReceitaResponse buscar(@PathVariable UUID id) {
        registrarLeituraReceita();
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ReceitaResponse> criar(@Valid @RequestBody ReceitaRequest req) {
        ReceitaResponse r = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @PutMapping("/{id}")
    public ReceitaResponse atualizar(@PathVariable UUID id, @Valid @RequestBody ReceitaRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }

    /**
     * LGPD (ADR-003): contabiliza leitura de receita (dado sensível — grau/cpf criptografados).
     * Nome exposto: {@code visionbox_lgpd_leitura_receita_total{loja=...}}.
     * Nota: optamos por tag de loja real da requisição (não tag estática de ambiente) para
     * o dashboard "Multi-loja"/"LGPD" (docs/METRICS.md §Instrumentação).
     */
    private void registrarLeituraReceita() {
        if (meterRegistry != null) {
            String loja = TenantContext.getCurrentLojaId().map(UUID::toString).orElse("none");
            meterRegistry.counter("visionbox_lgpd_leitura_receita", "loja", loja).increment();
        }
    }
}
