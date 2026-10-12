package com.visionbox.modules.catalogo.controller;

import com.visionbox.modules.catalogo.dto.ProdutoRequest;
import com.visionbox.modules.catalogo.dto.ProdutoResponse;
import com.visionbox.modules.catalogo.service.ProdutoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

import com.visionbox.shared.dto.ImportacaoResultado;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/produtos")
@RequiredArgsConstructor
public class ProdutoController {

    private final ProdutoService service;

    @GetMapping
    public Page<ProdutoResponse> listar(@RequestParam(required = false) String q,
                                        // alias usado pelo frontend (GET ?search=)
                                        @RequestParam(required = false) String search,
                                        @RequestParam(required = false) String categoria,
                                        @RequestParam(required = false) String marca,
                                        @PageableDefault(size = 20, sort = "nome") Pageable pageable) {
        String termo = (q != null && !q.isBlank()) ? q : search;
        return service.listar(termo, categoria, marca, pageable);
    }

    @GetMapping("/sugestao-sku-ean")
    public com.visionbox.modules.catalogo.dto.SugestaoSkuEanResponse obterSugestaoSkuEan() {
        return service.obterSugestaoSkuEan();
    }

    @GetMapping("/proximo-sku-ean")
    public com.visionbox.modules.catalogo.dto.SugestaoSkuEanResponse obterProximoSkuEan() {
        return service.obterSugestaoSkuEan();
    }

    @GetMapping("/{id}")
    public ProdutoResponse buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ProdutoResponse> criar(@Valid @RequestBody ProdutoRequest req) {
        ProdutoResponse r = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(r);
    }

    @PostMapping(value = "/importar-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportacaoResultado> importarCsv(@RequestParam("file") MultipartFile file) {
        ImportacaoResultado res = service.importarCsv(file);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/modelo-importacao")
    public ResponseEntity<byte[]> baixarModelo(@RequestParam(defaultValue = "xlsx") String formato) throws java.io.IOException {
        byte[] bytes = service.exportarModeloProdutos(formato);
        boolean isExcel = "xlsx".equalsIgnoreCase(formato) || "excel".equalsIgnoreCase(formato);
        String filename = isExcel ? "modelo-produtos.xlsx" : "modelo-produtos.csv";
        String contentType = isExcel
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv; charset=utf-8";

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, contentType)
                .body(bytes);
    }

    @PutMapping("/{id}")
    public ProdutoResponse atualizar(@PathVariable UUID id, @Valid @RequestBody ProdutoRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }
}
