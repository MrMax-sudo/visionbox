package com.visionbox.modules.producao.controller;

import com.visionbox.modules.producao.dto.ProducaoCQRequest;
import com.visionbox.modules.producao.dto.ProducaoResponse;
import com.visionbox.modules.producao.service.ProducaoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/producao")
@RequiredArgsConstructor
public class ProducaoController {

    private final ProducaoService service;

    @GetMapping("/fila")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','TECNICO','LABORATORIO')")
    public ResponseEntity<Page<ProducaoResponse>> fila(
            @RequestParam(required = false) UUID laboratorioId,
            Pageable pageable) {
        if (laboratorioId != null) {
            return ResponseEntity.ok(service.listarFila(pageable, laboratorioId));
        }
        return ResponseEntity.ok(service.listarFila(pageable));
    }

    @PostMapping("/{osId}/iniciar")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','TECNICO','LABORATORIO')")
    public ResponseEntity<ProducaoResponse> iniciar(@PathVariable UUID osId) {
        return ResponseEntity.ok(service.iniciar(osId));
    }

    @PostMapping("/{osId}/finalizar")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','TECNICO','LABORATORIO')")
    public ResponseEntity<ProducaoResponse> finalizar(@PathVariable UUID osId) {
        return ResponseEntity.ok(service.finalizar(osId));
    }

    @PostMapping("/{osId}/cq")
    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','TECNICO','LABORATORIO')")
    public ResponseEntity<ProducaoResponse> registrarCQ(
            @PathVariable UUID osId,
            @Valid @RequestBody ProducaoCQRequest request) {
        return ResponseEntity.ok(service.registrarCQ(osId, request));
    }
}