package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.FinanceiroTotaisResponse;
import com.visionbox.modules.financeiro.service.FinanceiroTotaisService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Métricas agregadas do hub Financeiro (§3.3, V41).
 * GET /api/v1/financeiro/totais?dataInicio&dataFim — somas SUM no banco (fim do
 * cálculo client-side sobre uma página size=100). Sem datas → mês corrente.
 * RBAC: matcher global /api/v1/financeiro/** → ADMIN/GERENTE/FINANCEIRO
 * (SecurityConfig); @PreAuthorize abaixo é defesa em profundidade (mesmo padrão
 * do estorno de baixa em ContaReceberController).
 */
@RestController
@RequestMapping("/api/v1/financeiro")
@RequiredArgsConstructor
public class FinanceiroTotaisController {

    private final FinanceiroTotaisService service;

    @PreAuthorize("hasAnyRole('ADMIN','GERENTE','FINANCEIRO')")
    @GetMapping("/totais")
    public FinanceiroTotaisResponse totais(@RequestParam(required = false) LocalDate dataInicio,
                                           @RequestParam(required = false) LocalDate dataFim) {
        return service.totais(dataInicio, dataFim);
    }
}
