package com.visionbox.modules.pessoa.empresaconfig.controller;

import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaRequest;
import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaResponse;
import com.visionbox.modules.pessoa.empresaconfig.service.EmpresaConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/empresa")
@RequiredArgsConstructor
public class EmpresaController {

    private final EmpresaConfigService service;

    @GetMapping
    public EmpresaResponse buscar() {
        return service.buscarAtual();
    }

    @PutMapping
    public EmpresaResponse atualizar(@Valid @RequestBody EmpresaRequest req) {
        return service.atualizar(req);
    }
}