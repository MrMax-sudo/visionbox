package com.visionbox.modules.laboratorio.controller;

import com.visionbox.modules.laboratorio.dto.LabPortalDetalhesResponse;
import com.visionbox.modules.laboratorio.dto.LabPortalTokenRequest;
import com.visionbox.modules.laboratorio.dto.LabPortalTokenResponse;
import com.visionbox.modules.laboratorio.service.LabPortalTokenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/laboratorios")
@RequiredArgsConstructor
public class LabPortalTokenController {

    private final LabPortalTokenService service;

    @PostMapping("/portal-tokens")
    public ResponseEntity<LabPortalTokenResponse> gerar(@Valid @RequestBody LabPortalTokenRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.gerar(request));
    }

    @GetMapping("/portal/{token}")
    public ResponseEntity<LabPortalDetalhesResponse> obterDetalhes(@PathVariable String token) {
        return ResponseEntity.ok(service.obterDetalhesPortal(token));
    }

    @PatchMapping("/portal/{token}/status")
    public ResponseEntity<Void> atualizarStatus(
            @PathVariable String token,
            @RequestBody Map<String, String> body
    ) {
        String novoStatus = body != null ? body.get("status") : null;
        String observacao = body != null ? body.get("observacao") : null;
        if (novoStatus == null || novoStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        service.atualizarStatusPortal(token, novoStatus, observacao);
        return ResponseEntity.noContent().build();
    }
}
