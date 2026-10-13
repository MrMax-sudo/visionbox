package com.visionbox.modules.modulos.controller;

import com.visionbox.modules.modulos.dto.ModuloDtos.AlternarModulosRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.AplicarPlanoRequest;
import com.visionbox.modules.modulos.dto.ModuloDtos.LojaResumoResponse;
import com.visionbox.modules.modulos.dto.ModuloDtos.ModuloConfiguracaoStatusResponse;
import com.visionbox.modules.modulos.service.ModuloConfiguracaoService;
import com.visionbox.modules.modulos.service.ModuloTenantScope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Painel do Desenvolvedor — Gestor SaaS de Módulos & Planos (spec §4.3).
 * <p>
 * Rotas (o SecurityConfig já cobre {@code /api/v1/dev/**} com ADMIN/DESENVOLVEDOR; o
 * {@code @PreAuthorize} abaixo é defesa em profundidade — SecurityConfig não foi alterado):
 * <ul>
 *   <li>{@code GET  /api/v1/dev/lojas} — lojas visíveis no seletor (DESENVOLVEDOR: todas;
 *       ADMIN: a própria)</li>
 *   <li>{@code GET  /api/v1/dev/lojas/{lojaId}/modulos} — status dos 19 módulos + plano</li>
 *   <li>{@code PUT  /api/v1/dev/lojas/{lojaId}/modulos} — toggle em lote com auditoria</li>
 *   <li>{@code PUT  /api/v1/dev/lojas/{lojaId}/modulos/plano} — aplica Start/Pro/Enterprise</li>
 * </ul>
 * Toda operação roda no escopo de tenant da loja alvo ({@link ModuloTenantScope}) e grava
 * {@code log_auditoria} (quem alterou, quando, o quê).
 */
@RestController
@RequestMapping("/api/v1/dev/lojas")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','DESENVOLVEDOR')")
public class ModuloConfiguracaoController {

    private final ModuloConfiguracaoService service;

    @GetMapping
    public List<LojaResumoResponse> listarLojas() {
        return service.listarLojasPermitidas();
    }

    @GetMapping("/{lojaId}/modulos")
    public ModuloConfiguracaoStatusResponse listarModulos(@PathVariable UUID lojaId) {
        service.autorizarAcessoLoja(lojaId);
        return ModuloTenantScope.executar(lojaId, () -> service.listarStatus(lojaId));
    }

    @PutMapping("/{lojaId}/modulos")
    public ModuloConfiguracaoStatusResponse alternarModulos(
            @PathVariable UUID lojaId,
            @Valid @RequestBody AlternarModulosRequest req,
            HttpServletRequest httpRequest) {
        service.autorizarAcessoLoja(lojaId);
        return ModuloTenantScope.executar(lojaId,
                () -> service.alternarModulos(lojaId, req, httpRequest.getRemoteAddr()));
    }

    @PutMapping("/{lojaId}/modulos/plano")
    public ModuloConfiguracaoStatusResponse aplicarPlano(
            @PathVariable UUID lojaId,
            @Valid @RequestBody AplicarPlanoRequest req,
            HttpServletRequest httpRequest) {
        service.autorizarAcessoLoja(lojaId);
        return ModuloTenantScope.executar(lojaId,
                () -> service.aplicarPlano(lojaId, req, httpRequest.getRemoteAddr()));
    }
}
