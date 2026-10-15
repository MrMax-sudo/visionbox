package com.visionbox.modules.orcamento.controller;

import com.visionbox.modules.orcamento.domain.OrcamentoStatus;
import com.visionbox.modules.orcamento.dto.OrcamentoRequest;
import com.visionbox.modules.orcamento.dto.OrcamentoResponse;
import com.visionbox.modules.orcamento.service.OrcamentoService;
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
@RequestMapping("/api/v1/orcamentos")
@RequiredArgsConstructor
public class OrcamentoController {

    private final OrcamentoService service;

    @GetMapping
    public Page<OrcamentoResponse> listar(
            @RequestParam(required = false) OrcamentoStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        String termo = (q != null && !q.isBlank()) ? q : search;
        return service.listar(status, termo, pageable);
    }

    @GetMapping("/{id}")
    public OrcamentoResponse buscarPorId(@PathVariable UUID id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<OrcamentoResponse> criar(@Valid @RequestBody OrcamentoRequest req) {
        OrcamentoResponse resp = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PutMapping("/{id}/status")
    public OrcamentoResponse atualizarStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body
    ) {
        String statusStr = body.get("status");
        if (statusStr == null || statusStr.isBlank()) {
            throw new IllegalArgumentException("O campo 'status' é obrigatório.");
        }
        OrcamentoStatus novoStatus = OrcamentoStatus.valueOf(statusStr.toUpperCase());
        return service.atualizarStatus(id, novoStatus);
    }

    @PostMapping("/{id}/converter")
    public OrcamentoResponse converter(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body
    ) {
        UUID vendaId = null;
        if (body != null && body.containsKey("vendaId") && !body.get("vendaId").isBlank()) {
            vendaId = UUID.fromString(body.get("vendaId"));
        }
        return service.converterEmVenda(id, vendaId);
    }

    @PutMapping("/{id}")
    public OrcamentoResponse atualizar(@PathVariable UUID id, @Valid @RequestBody OrcamentoRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable UUID id) {
        service.excluir(id);
    }
}
