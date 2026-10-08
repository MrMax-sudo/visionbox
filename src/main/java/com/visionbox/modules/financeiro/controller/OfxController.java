package com.visionbox.modules.financeiro.controller;

import com.visionbox.modules.financeiro.dto.ConciliacaoOfxResponse;
import com.visionbox.modules.financeiro.dto.OfxImportarRequest;
import com.visionbox.modules.financeiro.dto.OfxImportarResponse;
import com.visionbox.modules.financeiro.service.OfxConciliacaoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * OfxController — US13 conciliação OFX.
 * <p>
 * POST /api/v1/financeiro/ofx/importar
 *   - JSON: {"conteudo": "<texto OFX>", "toleranciaDias": 3, "conciliar": true}
 *   - OU corpo cru (OFX texto) com Content-Type text/plain|application/xml|
 *     text/xml|application/ofx|text/ofx e parâmetros toleranciaDias/conciliar.
 * GET  /api/v1/financeiro/ofx/conciliacoes?status=&inicio=&fim=&page=&size=
 * <p>
 * RBAC: /api/v1/financeiro/** → ADMIN, GERENTE, FINANCEIRO (SecurityConfig).
 */
@RestController
@RequestMapping("/api/v1/financeiro/ofx")
@RequiredArgsConstructor
public class OfxController {

    private final OfxConciliacaoService service;

    @PostMapping(value = "/importar", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<OfxImportarResponse> importarJson(@Valid @RequestBody OfxImportarRequest request) {
        return ResponseEntity.ok(service.importar(request));
    }

    @PostMapping(value = "/importar", consumes = {
            MediaType.TEXT_PLAIN_VALUE,
            MediaType.APPLICATION_XML_VALUE,
            "text/xml",
            "application/ofx",
            "text/ofx"
    })
    public ResponseEntity<OfxImportarResponse> importarTexto(@RequestBody String conteudo,
                                                             @RequestParam(required = false) Integer toleranciaDias,
                                                             @RequestParam(required = false) Boolean conciliar) {
        OfxImportarResponse response = service.importarConteudo(conteudo, toleranciaDias, conciliar);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/conciliacoes")
    public Page<ConciliacaoOfxResponse> conciliacoes(@RequestParam(required = false) String status,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
                                                     @PageableDefault(size = 20, direction = Sort.Direction.DESC, sort = {"dataPostamento", "criadoEm"}) Pageable pageable) {
        return service.listar(status, inicio, fim, pageable);
    }
}