package com.visionbox.modules.financeiro.maquininha.controller;

import com.visionbox.modules.financeiro.maquininha.dto.MaquininhaCartaoRequest;
import com.visionbox.modules.financeiro.maquininha.dto.MaquininhaCartaoResponse;
import com.visionbox.modules.financeiro.maquininha.dto.MdrCalculoRequest;
import com.visionbox.modules.financeiro.maquininha.dto.ResultadoMdr;
import com.visionbox.modules.financeiro.maquininha.service.MaquininhaCartaoService;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.security.RequerModulo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Maquininhas e taxas MDR (§3.5). Sob /api/v1/financeiro/** → regra RBAC existente
 * (ADMIN, GERENTE, FINANCEIRO) — sem mudança no SecurityConfig.
 * R11: condicionado ao módulo {@code FINANCEIRO_COMPLETO} (default ativo sem linha, D-014).
 */
@RestController
@RequestMapping("/api/v1/financeiro/maquininhas")
@RequerModulo(ModuloSistema.FINANCEIRO_COMPLETO)
@RequiredArgsConstructor
public class MaquininhaCartaoController {

    private final MaquininhaCartaoService service;

    @GetMapping
    public List<MaquininhaCartaoResponse> listar() {
        return service.listarAtivas();
    }

    @GetMapping("/{id}")
    public MaquininhaCartaoResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<MaquininhaCartaoResponse> criar(@Valid @RequestBody MaquininhaCartaoRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(req));
    }

    @PutMapping("/{id}")
    public MaquininhaCartaoResponse atualizar(@PathVariable UUID id, @Valid @RequestBody MaquininhaCartaoRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }

    /** Líquido de um valor: taxa e valor líquido (conciliação/simulação). */
    @PostMapping("/{id}/calcular-liquido")
    public ResultadoMdr calcularLiquido(@PathVariable UUID id, @Valid @RequestBody MdrCalculoRequest req) {
        return service.calcularLiquido(id, req);
    }
}
