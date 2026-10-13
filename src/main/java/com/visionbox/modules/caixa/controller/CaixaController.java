package com.visionbox.modules.caixa.controller;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.dto.CaixaDTOs.*;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/caixa")
@RequiredArgsConstructor
public class CaixaController {

    private final CaixaService caixaService;

    @GetMapping("/status-atual")
    public ResponseEntity<CaixaSessaoDTO> obterStatusAtual() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return caixaService.obterSessaoAtual(lojaId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/abrir")
    public ResponseEntity<CaixaSessaoDTO> abrirCaixa(
            @Valid @RequestBody AbrirCaixaRequest req,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        // Em caso de fallback sem ID de usuário no UserDetails, geramos UUID fixo de sessão
        UUID usuarioId = UUID.nameUUIDFromBytes((userDetails != null ? userDetails.getUsername() : "operador").getBytes());
        CaixaSessaoDTO dto = caixaService.abrirCaixa(lojaId, usuarioId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping("/movimentar")
    public ResponseEntity<CaixaSessaoDTO> movimentar(@Valid @RequestBody MovimentarCaixaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        CaixaSessaoDTO dto = caixaService.movimentar(lojaId, req);
        return ResponseEntity.ok(dto);
    }

    /**
     * Sangria de gaveta — motivo + valor obrigatórios.
     * Aceita header {@code Idempotency-Key} (R4): o {@code IdempotencyFilter} global
     * faz o replay/resumo no servidor para reenvios (PDV offline sincronizando).
     */
    @PostMapping("/sangria")
    public ResponseEntity<CaixaSessaoDTO> sangria(
            @Valid @RequestBody SangriaSuprimentoRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        CaixaSessaoDTO dto = caixaService.sangria(lojaId, req);
        return ResponseEntity.ok(dto);
    }

    /**
     * Suprimento de gaveta — motivo + valor obrigatórios.
     * Aceita header {@code Idempotency-Key} (R4), mesma cobertura da sangria.
     */
    @PostMapping("/suprimento")
    public ResponseEntity<CaixaSessaoDTO> suprimento(
            @Valid @RequestBody SangriaSuprimentoRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        CaixaSessaoDTO dto = caixaService.suprimento(lojaId, req);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/fechar")
    public ResponseEntity<CaixaSessaoDTO> fechar(@Valid @RequestBody FecharCaixaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        CaixaSessaoDTO dto = caixaService.fecharCaixa(lojaId, req);
        return ResponseEntity.ok(dto);
    }

    /** Extrato paginado do turno, com filtro opcional por tipo de movimento. */
    @GetMapping("/{sessaoId}/extrato")
    public ResponseEntity<Page<CaixaMovimentoDTO>> extrato(
            @PathVariable UUID sessaoId,
            @RequestParam(required = false) CaixaMovimento.TipoMovimento tipo,
            @PageableDefault(size = 50, sort = "criadoEm") Pageable pageable
    ) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return ResponseEntity.ok(caixaService.extrato(lojaId, sessaoId, tipo, pageable));
    }

    /** Relatório consolidado de fechamento (JSON para cupom térmico 80mm). */
    @GetMapping("/{sessaoId}/fechamento")
    public ResponseEntity<RelatorioFechamentoDTO> relatorioFechamento(@PathVariable UUID sessaoId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return ResponseEntity.ok(caixaService.relatorioFechamento(lojaId, sessaoId));
    }

    @GetMapping("/historico")
    public Page<CaixaSessaoDTO> listarHistorico(
            @RequestParam(required = false) UUID operadorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OffsetDateTime inicio = dataInicio != null
                ? dataInicio.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime() : null;
        // dataFim é inclusiva: vira início do dia seguinte para cobrir o dia inteiro
        OffsetDateTime fim = dataFim != null
                ? dataFim.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime() : null;
        return caixaService.listarHistorico(lojaId, operadorId, inicio, fim, pageable);
    }
}
