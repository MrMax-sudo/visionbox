package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.DREResponse;
import com.visionbox.modules.financeiro.service.DREService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/financeiro/dre")
@RequiredArgsConstructor
public class DREController {

    private final DREService dreService;

    @GetMapping
    public DREResponse relatorio(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
                                 @RequestParam(required = false) BigDecimal taxaComissao) {
        return dreService.calcular(inicio, fim, taxaComissao);
    }

    @GetMapping("/mes-atual")
    public DREResponse mesAtual() {
        return dreService.calcularMesAtual();
    }
}
