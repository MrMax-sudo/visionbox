package com.visionbox.modules.financeiro.comissao.controller;

import com.visionbox.modules.financeiro.comissao.dto.ApurarComissaoRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoFechamentoResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoLancamentoResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoVendedorResponse;
import com.visionbox.modules.financeiro.comissao.service.ComissaoService;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.security.RequerModulo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Comissões de vendedores (§3.6): regras, apuração por venda e fechamento por período.
 * Sob /api/v1/financeiro/** → regra RBAC existente (ADMIN, GERENTE, FINANCEIRO) —
 * sem mudança no SecurityConfig.
 * R11: condicionado ao módulo {@code FINANCEIRO_COMPLETO} (default ativo sem linha, D-014).
 */
@RestController
@RequestMapping("/api/v1/financeiro/comissoes")
@RequerModulo(ModuloSistema.FINANCEIRO_COMPLETO)
@RequiredArgsConstructor
public class ComissaoController {

    private final ComissaoService service;

    // ------------------------- regras -------------------------

    @GetMapping("/config")
    public List<ComissaoConfigResponse> listarConfigs() {
        return service.listarConfigs();
    }

    @PostMapping("/config")
    public ResponseEntity<ComissaoConfigResponse> criarConfig(@Valid @RequestBody ComissaoConfigRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criarConfig(req));
    }

    @PutMapping("/config/{id}")
    public ComissaoConfigResponse atualizarConfig(@PathVariable UUID id,
                                                  @Valid @RequestBody ComissaoConfigRequest req) {
        return service.atualizarConfig(id, req);
    }

    @DeleteMapping("/config/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerConfig(@PathVariable UUID id) {
        service.removerConfig(id);
    }

    // ------------------------- apuração e fechamento -------------------------

    /**
     * Vendedores ativos da loja que apuram comissão (VENDEDOR, OTICO) — id+nome.
     * Liberado pelo matcher /api/v1/financeiro/** (ADMIN, GERENTE, FINANCEIRO):
     * substitui a listagem de /v1/usuarios, que é ADMIN-only e deixava o picker
     * de apuração/fechamento degradado para GERENTE/FINANCEIRO.
     */
    @GetMapping("/vendedores")
    public List<ComissaoVendedorResponse> vendedores() {
        return service.listarVendedores();
    }

    /** Apura a comissão de uma venda (idempotente por venda+vendedor). */
    @PostMapping("/apurar")
    public ResponseEntity<List<ComissaoLancamentoResponse>> apurar(@Valid @RequestBody ApurarComissaoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.apurar(req));
    }

    /** Fechamento de comissões por período, agregado por vendedor. */
    @GetMapping("/fechamento")
    public ComissaoFechamentoResponse fechamento(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) UUID vendedorId) {
        return service.fechamento(dataInicio, dataFim, vendedorId);
    }
}
