package com.visionbox.modules.catalogo.controller;

import com.visionbox.modules.catalogo.dto.CategoriaRequest;
import com.visionbox.modules.catalogo.dto.CategoriaResponse;
import com.visionbox.modules.catalogo.service.CategoriaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categorias")
@RequiredArgsConstructor
public class CategoriaController {

    private final CategoriaService service;

    @GetMapping
    public Page<CategoriaResponse> listar(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 50, sort = "nome") Pageable pageable) {
        String termo = (q != null && !q.isBlank()) ? q : search;
        return service.listar(termo, pageable);
    }

    @GetMapping("/todas")
    public List<CategoriaResponse> listarTodas() {
        return service.listarTodas();
    }

    @GetMapping("/{id}")
    public CategoriaResponse buscarPorId(@PathVariable UUID id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<CategoriaResponse> criar(@Valid @RequestBody CategoriaRequest request) {
        CategoriaResponse response = service.criar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public CategoriaResponse atualizar(@PathVariable UUID id, @Valid @RequestBody CategoriaRequest request) {
        return service.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
