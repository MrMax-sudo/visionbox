package com.visionbox.modules.clinico.controller;

import com.visionbox.modules.clinico.domain.Receita;
import com.visionbox.modules.clinico.repository.ReceitaRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * ReceitaAnexoController — upload e visualização de foto da receita em S3/MinIO ou storage local.
 * <p>
 * Endpoint: POST /api/v1/receitas/{id}/anexo (multipart/form-data, campo "file")
 * Endpoint: GET  /api/v1/receitas/{id}/anexo (retorna a imagem/PDF armazenada)
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/receitas")
@RequiredArgsConstructor
public class ReceitaAnexoController {

    private final ReceitaRepository receitaRepository;

    @Value("${visionbox.s3.bucket:visionbox-receitas}")
    private String bucket;

    @Value("${visionbox.s3.endpoint:http://localhost:9000}")
    private String endpoint;

    @Value("${visionbox.storage.upload-dir:data/uploads}")
    private String uploadDir;

    private static final long MAX_BYTES = 8L * 1024 * 1024; // 8MB

    @PostMapping(value = "/{id}/anexo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<Map<String, Object>> uploadAnexo(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {

        UUID lojaId = TenantContext.requireCurrentLojaId();

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Arquivo vazio ou não enviado (campo 'file' obrigatório)");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Arquivo excede limite de 8MB (tamanho: " + file.getSize() + " bytes)");
        }

        Receita receita = receitaRepository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));

        String original = file.getOriginalFilename();
        String ext = extractExtension(original);
        if (ext == null || ext.isBlank()) ext = ".jpg";
        if (!ext.matches("\\.(jpg|jpeg|png|pdf|webp)")) {
            ext = ".jpg";
        }

        String fileId = UUID.randomUUID().toString();
        String relativePath = "loja-" + lojaId + "/receitas/" + fileId + ext.toLowerCase();

        try {
            Path targetPath = Paths.get(uploadDir, relativePath);
            Files.createDirectories(targetPath.getParent());
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("Arquivo físico salvo em: {}", targetPath.toAbsolutePath());
        } catch (IOException e) {
            log.warn("Erro ao salvar arquivo localmente em {}: {}", uploadDir, e.getMessage());
        }

        receita.setAnexoS3Key(relativePath);
        receita.setAnexoS3Bucket(bucket);
        receitaRepository.save(receita);

        String localViewUrl = "/api/v1/receitas/" + id + "/anexo";

        log.info("Receita anexo upload loja={} receita={} key={} bucket={} size={}", lojaId, id, relativePath, bucket, file.getSize());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", receita.getId().toString());
        body.put("lojaId", lojaId.toString());
        body.put("anexoS3Key", relativePath);
        body.put("anexoS3Bucket", bucket);
        body.put("url", localViewUrl);
        body.put("size", file.getSize());
        body.put("contentType", file.getContentType());
        body.put("originalFilename", original);

        return ResponseEntity.ok(body);
    }

    @GetMapping("/{id}/anexo")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> visualizarAnexo(@PathVariable UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Receita receita = receitaRepository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Receita não encontrada"));

        if (receita.getAnexoS3Key() == null || receita.getAnexoS3Key().isBlank()) {
            throw new EntityNotFoundException("Esta receita não possui anexo.");
        }

        Path targetPath = Paths.get(uploadDir, receita.getAnexoS3Key());
        File file = targetPath.toFile();
        if (!file.exists()) {
            throw new EntityNotFoundException("Arquivo de anexo não encontrado no servidor.");
        }

        String contentType;
        try {
            contentType = Files.probeContentType(targetPath);
        } catch (IOException e) {
            contentType = "application/octet-stream";
        }
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .body(resource);
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) return null;
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) return null;
        return filename.substring(idx).toLowerCase();
    }
}
