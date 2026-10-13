package com.visionbox.modules.financeiro.fornecedor.controller;

import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorRequest;
import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorResponse;
import com.visionbox.modules.financeiro.fornecedor.service.FornecedorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * CRUD de Fornecedores (§3.3). Protegido pelo matcher global
 * /api/v1/financeiro/** → roles ADMIN, GERENTE, FINANCEIRO (SecurityConfig).
 */
@RestController
@RequestMapping("/api/v1/financeiro/fornecedores")
@RequiredArgsConstructor
public class FornecedorController {

    private final FornecedorService service;

    @GetMapping
    public Page<FornecedorResponse> listar(@RequestParam(required = false) String nome,
                                           @RequestParam(required = false, defaultValue = "false")
                                           boolean incluirInativos,
                                           @PageableDefault(size = 20, sort = "nome") Pageable pageable) {
        return service.listar(nome, incluirInativos, pageable);
    }

    @GetMapping("/{id}")
    public FornecedorResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<FornecedorResponse> criar(@Valid @RequestBody FornecedorRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(req));
    }

    @PutMapping("/{id}")
    public FornecedorResponse atualizar(@PathVariable UUID id, @Valid @RequestBody FornecedorRequest req) {
        return service.atualizar(id, req);
    }

    /**
     * Reativação (§3.3 — reversal do soft-delete do DELETE): seta ativo=true sem tocar
     * a cifra do CNPJ. 404 se id de outra loja (R1); 409 se o CNPJ já existir em outro
     * fornecedor ATIVO da loja; idempotente se já estiver ativo. Sem body.
     * Idempotência (R4): header Idempotency-Key coberto pelo IdempotencyFilter global.
     */
    @PostMapping("/{id}/reativar")
    public FornecedorResponse reativar(@PathVariable UUID id) {
        return service.reativar(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }
}
