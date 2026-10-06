package com.visionbox.modules.estoque.controller;

import com.visionbox.modules.estoque.dto.EstoqueLoteRequest;
import com.visionbox.modules.estoque.dto.EstoqueLoteResponse;
import com.visionbox.modules.estoque.service.EstoqueLoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/estoque/lotes")
@RequiredArgsConstructor
public class EstoqueLoteController {

    private final EstoqueLoteService service;

    @PostMapping
    public ResponseEntity<EstoqueLoteResponse> criar(@Valid @RequestBody EstoqueLoteRequest req) {
        EstoqueLoteResponse r = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @GetMapping
    public Page<EstoqueLoteResponse> listar(@PageableDefault(size = 20, sort = "validade") Pageable pageable) {
        return service.listar(pageable);
    }

    @GetMapping("/{id}")
    public EstoqueLoteResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping("/{id}/bloquear")
    public EstoqueLoteResponse bloquear(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        String motivo = body != null ? body.get("motivo") : null;
        if (motivo == null && body != null) motivo = body.get("motivoBloqueio");
        return service.bloquear(id, motivo);
    }

    @PostMapping("/{id}/ajustar")
    public EstoqueLoteResponse ajustar(@PathVariable UUID id, @RequestBody Map<String, Integer> body) {
        int quantidade = body.getOrDefault("quantidade", 0);
        return service.ajustarQuantidade(id, quantidade);
    }
}
