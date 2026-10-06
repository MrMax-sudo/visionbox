package com.visionbox.modules.estoque.controller;

import com.visionbox.modules.estoque.dto.EstoqueResponse;
import com.visionbox.modules.estoque.service.EstoqueService;
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
@RequestMapping("/api/v1/estoque")
@RequiredArgsConstructor
public class EstoqueController {

    private final EstoqueService service;

    @GetMapping
    public Page<EstoqueResponse> listar(@PageableDefault(size = 20, sort = "produtoId") Pageable pageable) {
        return service.listar(pageable);
    }

    @GetMapping("/{id}")
    public EstoqueResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @GetMapping("/produto/{produtoId}")
    public EstoqueResponse buscarPorProduto(@PathVariable UUID produtoId) {
        return service.buscarPorProduto(produtoId);
    }

    @PostMapping("/produto/{produtoId}/ajustar")
    public ResponseEntity<EstoqueResponse> ajustar(@PathVariable UUID produtoId, @RequestBody Map<String, Integer> body) {
        int quantidade = body.getOrDefault("quantidade", 0);
        return ResponseEntity.status(HttpStatus.OK).body(service.criarOuAjustar(produtoId, quantidade));
    }

    @PostMapping("/produto/{produtoId}/adicionar")
    public ResponseEntity<EstoqueResponse> adicionar(@PathVariable UUID produtoId, @RequestBody Map<String, Integer> body) {
        int delta = body.getOrDefault("quantidade", body.getOrDefault("delta", 1));
        return ResponseEntity.status(HttpStatus.OK).body(service.adicionar(produtoId, delta));
    }

    @PostMapping("/produto/{produtoId}/reservar")
    public ResponseEntity<EstoqueResponse> reservar(@PathVariable UUID produtoId, @RequestBody Map<String, Integer> body) {
        int qtd = body.getOrDefault("quantidade", body.getOrDefault("qtd", 1));
        return ResponseEntity.ok(service.reservar(produtoId, qtd));
    }

    @PostMapping("/produto/{produtoId}/baixar")
    public ResponseEntity<EstoqueResponse> baixar(@PathVariable UUID produtoId, @RequestBody Map<String, Integer> body) {
        int qtd = body.getOrDefault("quantidade", body.getOrDefault("qtd", 1));
        return ResponseEntity.ok(service.baixarAoEntregue(produtoId, qtd));
    }

    @PostMapping("/produto/{produtoId}/estornar")
    public ResponseEntity<EstoqueResponse> estornar(@PathVariable UUID produtoId, @RequestBody Map<String, Integer> body) {
        int qtd = body.getOrDefault("quantidade", body.getOrDefault("qtd", 1));
        return ResponseEntity.ok(service.estornarAoCancelado(produtoId, qtd));
    }
}
