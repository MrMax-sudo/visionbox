package com.visionbox.modules.vendas.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.visionbox.modules.vendas.dto.PedidoVendaRequest;
import com.visionbox.modules.vendas.dto.PedidoVendaResponse;
import com.visionbox.shared.idempotency.IdempotencyKey;
import com.visionbox.shared.idempotency.IdempotencyRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * PDV — endpoint idempotente com header Idempotency-Key (arquivo.md §13, GOVERNANCE DoD).
 * Botão Finalizar sempre ativo offline → sync com mesma key não duplica venda.
 * Usa IdempotencyKey canônico UNIQUE(loja_id, chave) + IdempotencyFilter replay.
 * Este controller demonstra uso direto (além do filter) para testes de contrato.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vendas")
@RequiredArgsConstructor
public class PedidoVendaController {

    private final IdempotencyRepository idempotencyRepository;
    private final ObjectMapper objectMapper;

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
