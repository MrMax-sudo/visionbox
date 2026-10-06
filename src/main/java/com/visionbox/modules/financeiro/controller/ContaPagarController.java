package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.ContaPagarRequest;
import com.visionbox.modules.financeiro.dto.ContaPagarResponse;
import com.visionbox.modules.financeiro.service.ContaPagarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/financeiro/contas-pagar")
@RequiredArgsConstructor
public class ContaPagarController {

    private final ContaPagarService service;

    @PostMapping
    public ResponseEntity<ContaPagarResponse> criar(@Valid @RequestBody ContaPagarRequest req) {
        ContaPagarResponse r = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @GetMapping
    public Page<ContaPagarResponse> listar(@RequestParam(required = false) String status,
                                           @RequestParam(required = false) String fornecedor,
                                           @PageableDefault(size = 20, sort = "vencimento") Pageable pageable) {
        return service.listar(status, fornecedor, pageable);
    }

    @GetMapping("/{id}")
    public ContaPagarResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping("/{id}/baixar")
    public ContaPagarResponse baixar(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        BigDecimal valor = null;
        if (body != null && body.get("valorPago") != null) {
            valor = new BigDecimal(body.get("valorPago")).setScale(2, RoundingMode.HALF_EVEN);
        } else if (body != null && body.get("valor") != null) {
            valor = new BigDecimal(body.get("valor")).setScale(2, RoundingMode.HALF_EVEN);
        }
        return service.baixar(id, valor);
    }

    @PostMapping("/{id}/cancelar")
    public ContaPagarResponse cancelar(@PathVariable UUID id) {
        return service.cancelar(id);
    }
}
