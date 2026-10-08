package com.visionbox.modules.financeiro.formapagamento.controller;

import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoRequest;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoResponse;
import com.visionbox.modules.financeiro.formapagamento.service.FormaPagamentoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/financeiro/formas-pagamento")
@RequiredArgsConstructor
public class FormaPagamentoController {

    private final FormaPagamentoService service;

    @GetMapping
    public List<FormaPagamentoResponse> listar() {
        return service.listarAtivas();
    }

    @GetMapping("/{id}")
    public FormaPagamentoResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<FormaPagamentoResponse> criar(@Valid @RequestBody FormaPagamentoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(req));
    }

    @PutMapping("/{id}")
    public FormaPagamentoResponse atualizar(@PathVariable UUID id, @Valid @RequestBody FormaPagamentoRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }
}
