package com.visionbox.modules.ordemservico.controller;

import com.visionbox.modules.ordemservico.dto.AlterarStatusRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.modules.ordemservico.service.SlaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ordens-servico")
@RequiredArgsConstructor
public class OrdemServicoController {

    private final OrdemServicoService service;
    private final SlaService slaService;

    @PostMapping
    public ResponseEntity<OrdemServicoResponse> criar(@Valid @RequestBody OrdemServicoRequest req) {
        OrdemServicoResponse r = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @GetMapping
    public Page<OrdemServicoResponse> listar(@RequestParam(required = false) String status,
                                             @PageableDefault(size = 20, sort = "criadoEm") Pageable pageable) {
        return service.listar(status, pageable);
    }

    @GetMapping("/{id}")
    public OrdemServicoResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PatchMapping("/{id}/status")
    public OrdemServicoResponse avancarStatus(@PathVariable UUID id, @Valid @RequestBody AlterarStatusRequest req) {
        return service.avancar(id, req);
    }

    /**
     * GET /api/v1/ordens-servico/atrasadas?size=20&page=0
     * Retorna OS com previsaoEntrega < now() e status NOT IN (ENTREGUE, CANCELADO, DEVOLVIDO_GARANTIA).
     * Paginado, ordenado por previsaoEntrega ASC (mais antigas primeiro).
     */
    @GetMapping("/atrasadas")
    public Page<OrdemServicoResponse> listarAtrasadas(
            @PageableDefault(size = 20, sort = "previsaoEntrega") Pageable pageable) {
        UUID lojaId = com.visionbox.shared.tenant.TenantContext.requireCurrentLojaId();
        return slaService.buscarAtrasadasPorLoja(lojaId, pageable)
                .map(service.getMapper()::toResponse);
    }
}
