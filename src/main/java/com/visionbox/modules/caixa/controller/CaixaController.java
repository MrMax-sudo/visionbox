package com.visionbox.modules.caixa.controller;

import com.visionbox.modules.caixa.dto.CaixaDTOs.*;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
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

    @PostMapping("/fechar")
    public ResponseEntity<CaixaSessaoDTO> fechar(@Valid @RequestBody FecharCaixaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        CaixaSessaoDTO dto = caixaService.fecharCaixa(lojaId, req);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/historico")
    public Page<CaixaSessaoDTO> listarHistorico(@PageableDefault(size = 20) Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return caixaService.listarHistorico(lojaId, pageable);
    }
}
