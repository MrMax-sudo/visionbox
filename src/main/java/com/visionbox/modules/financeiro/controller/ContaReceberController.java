package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.ContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import com.visionbox.modules.financeiro.service.ContaReceberService;
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
@RequestMapping("/api/v1/financeiro/contas-receber")
@RequiredArgsConstructor
public class ContaReceberController {

    private final ContaReceberService service;

    @PostMapping
    public ResponseEntity<ContaReceberResponse> criar(@Valid @RequestBody ContaReceberRequest req) {
        ContaReceberResponse r = service.gerar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @GetMapping
    public Page<ContaReceberResponse> listar(@RequestParam(required = false) String status,
                                             @PageableDefault(size = 20, sort = "vencimento") Pageable pageable) {
        return service.listar(status, pageable);
    }

    @GetMapping("/{id}")
    public ContaReceberResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping("/{id}/baixar")
    public ContaReceberResponse baixar(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        BigDecimal valor = null;
        if (body != null && body.get("valorPago") != null) {
            valor = new BigDecimal(body.get("valorPago")).setScale(2, RoundingMode.HALF_EVEN);
        } else if (body != null && body.get("valor") != null) {
            valor = new BigDecimal(body.get("valor")).setScale(2, RoundingMode.HALF_EVEN);
        }
        return service.baixar(id, valor);
    }

    @PostMapping("/{id}/cancelar")
    public ContaReceberResponse cancelar(@PathVariable UUID id) {
        return service.cancelar(id);
    }
}
