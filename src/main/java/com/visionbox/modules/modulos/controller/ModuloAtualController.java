package com.visionbox.modules.modulos.controller;

import com.visionbox.modules.modulos.dto.ModuloDtos.ModuloConfiguracaoStatusResponse;
import com.visionbox.modules.modulos.service.ModuloConfiguracaoService;
import com.visionbox.shared.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Módulos da loja autenticada — usado pelo {@code useModulosStore}/{@code GuardaModulo}
 * no login de QUALQUER perfil (o {@code /api/v1/dev/**} é restrito a ADMIN/DESENVOLVEDOR,
 * então o frontend comum precisa desta rota aberta a autenticados).
 * <p>
 * Segurança: sem matcher específico no SecurityConfig cai em
 * {@code anyRequest().authenticated()} — só autenticados, sempre da própria loja
 * (loja vem do JWT via {@code TenantContext}; nada de path de tenant aqui, R1).
 * Retorna apenas flags de recurso (código/nome/ativo/plano), sem dado pessoal.
 */
@RestController
@RequestMapping("/api/v1/modulos")
@RequiredArgsConstructor
public class ModuloAtualController {

    private final ModuloConfiguracaoService service;

    @GetMapping
    public ModuloConfiguracaoStatusResponse meusModulos() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return service.listarStatus(lojaId);
    }
}
