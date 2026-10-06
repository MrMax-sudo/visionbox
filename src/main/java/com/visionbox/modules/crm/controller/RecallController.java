package com.visionbox.modules.crm.controller;

import com.visionbox.modules.crm.dto.RecallResponse;
import com.visionbox.modules.crm.service.RecallService;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * RecallController — GET /api/v1/crm/recall?dias=30 paginado.
 * Filtro obrigatório por lojaId via TenantContext (X-Loja-Id / JWT).
 */
@RestController
@RequestMapping("/api/v1/crm/recall")
@RequiredArgsConstructor
public class RecallController {

    private final RecallService recallService;

    @GetMapping
    public Page<RecallResponse> listar(
            @RequestParam(defaultValue = "30") int dias,
            @PageableDefault(size = 20, sort = "dataValidade") Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return recallService.buscarReceitasVencidas(lojaId, dias, pageable);
    }
}
