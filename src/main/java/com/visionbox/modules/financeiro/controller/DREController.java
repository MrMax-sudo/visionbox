package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.DREResponse;
import com.visionbox.modules.financeiro.service.DREService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * DREController — DRE por loja e por OS (US13).
 * <p>
 * GET /api/v1/financeiro/dre
 *   Contrato legado (mantido): ?inicio=&fim=&taxaComissao=
 *   Novo (US13):              ?lojaId=&osId=&periodo=
 *     - lojaId  : opcional; deve ser igual ao tenant autenticado (senão 400).
 *     - osId    : DRE por OS (receita conta_receber.os, custo conta_pagar.os).
 *     - periodo : "YYYY-MM" (mês) ou "YYYY-MM-DD..YYYY-MM-DD"; não combinar
 *                 com inicio/fim.
 * GET /api/v1/financeiro/dre/mes-atual (legado, inalterado)
 */
@RestController
@RequestMapping("/api/v1/financeiro/dre")
@RequiredArgsConstructor
public class DREController {

    private final DREService dreService;

    @GetMapping
    public DREResponse relatorio(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
                                 @RequestParam(required = false) BigDecimal taxaComissao,
                                 @RequestParam(required = false) UUID lojaId,
                                 @RequestParam(required = false) UUID osId,
                                 @RequestParam(required = false) String periodo) {
        return dreService.calcular(lojaId, osId, inicio, fim, taxaComissao, periodo);
    }

    @GetMapping("/mes-atual")
    public DREResponse mesAtual() {
        return dreService.calcularMesAtual();
    }
}