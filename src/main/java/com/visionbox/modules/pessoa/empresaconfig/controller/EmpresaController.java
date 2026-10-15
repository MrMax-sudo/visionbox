package com.visionbox.modules.pessoa.empresaconfig.controller;

import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaRequest;
import com.visionbox.modules.pessoa.empresaconfig.dto.EmpresaResponse;
import com.visionbox.modules.pessoa.empresaconfig.service.EmpresaConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

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

    @PostMapping("/logo")
    public EmpresaResponse uploadLogo(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestBody(required = false) Map<String, String> body
    ) throws IOException {
        String base64Data = null;
        if (file != null && !file.isEmpty()) {
            String mime = file.getContentType() != null ? file.getContentType() : "image/png";
            base64Data = "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(file.getBytes());
        } else if (body != null && body.containsKey("base64")) {
            base64Data = body.get("base64");
        } else if (body != null && body.containsKey("logoBase64")) {
            base64Data = body.get("logoBase64");
        }

        if (base64Data == null || base64Data.isBlank()) {
            throw new IllegalArgumentException("Arquivo de imagem ou base64 é obrigatório.");
        }
        return service.salvarLogo(base64Data);
    }

    @GetMapping(value = "/logo.png", produces = {MediaType.IMAGE_PNG_VALUE, MediaType.IMAGE_JPEG_VALUE})
    public ResponseEntity<byte[]> buscarLogo() {
        byte[] bytes = service.buscarLogoBytes();
        if (bytes == null || bytes.length == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(bytes);
    }
}