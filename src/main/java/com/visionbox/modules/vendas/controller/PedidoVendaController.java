package com.visionbox.modules.vendas.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.vendas.dto.CancelarVendaRequest;
import com.visionbox.modules.vendas.dto.PedidoVendaRequest;
import com.visionbox.modules.vendas.dto.PedidoVendaResponse;
import com.visionbox.modules.vendas.dto.VendaKpisDTO;
import com.visionbox.modules.vendas.dto.VendaViewDTO;
import com.visionbox.modules.vendas.service.VendaHistoricoService;
import com.visionbox.shared.idempotency.IdempotencyKey;
import com.visionbox.shared.idempotency.IdempotencyRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Controller de Vendas e Pedidos (Outbox ERP benchmark: ConsultaVendaController).
 * Suporta idempotência no POST de venda e endpoints completos para a Central de Vendas (/vendas).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vendas")
@RequiredArgsConstructor
public class PedidoVendaController {

    private final IdempotencyRepository idempotencyRepository;
    private final ObjectMapper objectMapper;
    private final VendaHistoricoService vendaHistoricoService;

    @GetMapping
    public ResponseEntity<Page<VendaViewDTO>> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statusFiscal,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "criadoEm", direction = Sort.Direction.DESC) Pageable pageable) {

        Page<VendaViewDTO> resultado = vendaHistoricoService.listar(
                dataInicio, dataFim, status, statusFiscal, search, pageable);
        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/kpis")
    public ResponseEntity<VendaKpisDTO> obterKpis(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim) {

        VendaKpisDTO kpis = vendaHistoricoService.obterKpis(dataInicio, dataFim);
        return ResponseEntity.ok(kpis);
    }

    @GetMapping("/{id}")
    public ResponseEntity<VendaViewDTO> buscarPorId(@PathVariable UUID id) {
        VendaViewDTO venda = vendaHistoricoService.buscarPorId(id);
        return ResponseEntity.ok(venda);
    }

    @PostMapping("/{id}/cancelar")
    public ResponseEntity<VendaViewDTO> cancelar(
            @PathVariable UUID id,
            @Valid @RequestBody CancelarVendaRequest request) {

        VendaViewDTO cancelada = vendaHistoricoService.cancelar(id, request);
        return ResponseEntity.ok(cancelada);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> criar(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody PedidoVendaRequest request) throws JsonProcessingException {

        UUID lojaId = TenantContext.requireCurrentLojaId();

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<IdempotencyKey> existente = idempotencyRepository.findByLojaIdAndChave(lojaId, idempotencyKey);
            if (existente.isPresent() && !existente.get().isExpirado() && existente.get().isProcessado()) {
                IdempotencyKey rec = existente.get();
                return ResponseEntity.status(rec.getStatusCode())
                        .header("Idempotent-Replayed", "true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(rec.getResponseBody());
            }
        }

        // Simula criação de pedido — em prod delega para PedidoVendaService + outbox
        PedidoVendaResponse resp = PedidoVendaResponse.builder()
                .id(UUID.randomUUID())
                .lojaId(lojaId)
                .numero("OS-2026-" + (int) (Math.random() * 100000))
                .status("CRIADO")
                .build();
        String body = objectMapper.writeValueAsString(resp);

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            // upsert idempotency — filter já criou pending, aqui atualiza
            Optional<IdempotencyKey> opt = idempotencyRepository.findByLojaIdAndChave(lojaId, idempotencyKey);
            if (opt.isPresent()) {
                IdempotencyKey rec = opt.get();
                rec.setStatusCode(201);
                rec.setResponseBody(body);
                rec.setResponseContentType(MediaType.APPLICATION_JSON_VALUE);
                idempotencyRepository.save(rec);
            } else {
                IdempotencyKey rec = IdempotencyKey.builder()
                        .lojaId(lojaId)
                        .chave(idempotencyKey)
                        .metodo("POST")
                        .path("/api/v1/vendas")
                        .statusCode(201)
                        .responseBody(body)
                        .responseContentType(MediaType.APPLICATION_JSON_VALUE)
                        .expiraEm(OffsetDateTime.now().plusHours(24))
                        .build();
                idempotencyRepository.save(rec);
            }
        }

        return ResponseEntity.status(201)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }
}
