package com.visionbox.modules.relatorios.controller;

import com.visionbox.modules.relatorios.dto.CurvaAbcResponse;
import com.visionbox.modules.relatorios.dto.GiroProdutoResponse;
import com.visionbox.modules.relatorios.dto.MargemVendedorResponse;
import com.visionbox.modules.relatorios.service.RelatorioBiService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Relatorios de BI (US16) — RBAC: ADMIN/GERENTE/FINANCEIRO (SecurityConfig).
 * <p>
 * Todos os endpoints são multi-tenant: a loja vem do TenantContext (JWT/header)
 * e é aplicada em todas as queries — nunca dados de outra loja (ADR-001).
 */
@RestController
@RequestMapping("/api/v1/relatorios")
@RequiredArgsConstructor
public class RelatorioBiController {

    private final RelatorioBiService service;

    /**
     * GET /api/v1/relatorios/giro-produtos?dataInicio=2026-09-01&dataFim=2026-09-30&page=0&size=20
     * Ranking de giro (quantidade vendida) por produto/período — ordem por
     * quantidade desc (ordenação fixa de ranking; pageable passa só page/size).
     */
    @GetMapping("/giro-produtos")
    public Page<GiroProdutoResponse> giroProdutos(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @PageableDefault(size = 20) Pageable pageable) {
        return service.giroProdutos(dataInicio, dataFim, somentePageSize(pageable));
    }

    /**
     * GET /api/v1/relatorios/margem-vendedor?dataInicio&dataFim&page&size
     * Receita, custo e margem por vendedor — ordem por margem desc.
     */
    @GetMapping("/margem-vendedor")
    public Page<MargemVendedorResponse> margemVendedor(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @PageableDefault(size = 20) Pageable pageable) {
        return service.margemVendedor(dataInicio, dataFim, somentePageSize(pageable));
    }

    /**
     * GET /api/v1/relatorios/curva-abc?dataInicio&dataFim
     * Classificação ABC de produtos por faturamento (A ≤ 80% ≤ B ≤ 95% < C).
     * Lista completa — a curva exige o conjunto global para o percentual acumulado.
     */
    @GetMapping("/curva-abc")
    public CurvaAbcResponse curvaAbc(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim) {
        return service.curvaAbc(dataInicio, dataFim);
    }

    /**
     * Mantém a ordenação fixa do ranking (quantidade/margem desc) — o sort do
     * cliente não tem coluna estável no SQL agregado e quebraria a páginação.
     */
    private Pageable somentePageSize(Pageable pageable) {
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
    }
}