package com.visionbox.modules.compras.controller;

import com.visionbox.modules.compras.dto.CompraResponse;
import com.visionbox.modules.compras.service.CompraImportacaoService;
import com.visionbox.modules.modulos.domain.ModuloSistema;
import com.visionbox.modules.modulos.security.RequerModulo;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Compras de fornecedores via XML NF-e de entrada (§3.4).
 * <p>
 * RBAC: rota nova — SecurityConfig precisa ganhar
 * {@code /api/v1/compras/** → hasAnyRole("ADMIN","GERENTE","FINANCEIRO")} (listado no relatório da Fase 4).
 * R11: controller condicionado a {@code COMPRAS_XML} via {@code @RequerModulo} (default sem
 * linha = módulo ativo, D-014).
 */
@RestController
@RequestMapping("/api/v1/compras")
@RequerModulo(ModuloSistema.COMPRAS_XML)
@RequiredArgsConstructor
public class CompraController {

    private final CompraImportacaoService service;

    /** Upload do XML da NF-e (multipart). */
    @PostMapping(value = "/importar-xml", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CompraResponse> importarXml(@RequestParam("file") MultipartFile file,
                                                      Authentication authentication) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Arquivo XML ausente (parâmetro 'file')");
        }
        String xml = new String(file.getBytes(), StandardCharsets.UTF_8);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.importarXml(xml, usuarioId(authentication)));
    }

    @GetMapping
    public Page<CompraResponse> listar(@PageableDefault(size = 20, sort = "criadoEm") Pageable pageable) {
        return service.listar(pageable);
    }

    @GetMapping("/{id}")
    public CompraResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    /** Critério do CaixaController/ContaReceberService: id estável derivado do username do JWT. */
    private UUID usuarioId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return null;
        return UUID.nameUUIDFromBytes(authentication.getName().getBytes(StandardCharsets.UTF_8));
    }
}
