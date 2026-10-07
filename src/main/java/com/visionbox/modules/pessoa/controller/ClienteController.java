package com.visionbox.modules.pessoa.controller;

import com.visionbox.modules.pessoa.dto.ClienteRequest;
import com.visionbox.modules.pessoa.dto.ClienteResponse;
import com.visionbox.modules.pessoa.service.ClienteService;
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
@RequestMapping("/api/v1/clientes")
@RequiredArgsConstructor
public class ClienteController {

    private final ClienteService service;

    @GetMapping
    public Page<ClienteResponse> listar(
            @RequestParam(required = false) String nome,
            // aliases usados pelo frontend (GET ?search= / ?q=)
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "nome") Pageable pageable) {
        String termo = (nome != null && !nome.isBlank()) ? nome
                : (search != null && !search.isBlank()) ? search : q;
        return service.listar(termo, pageable);
    }

    @GetMapping("/{id}")
    public ClienteResponse buscar(@PathVariable UUID id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<ClienteResponse> criar(@Valid @RequestBody ClienteRequest req) {
        ClienteResponse resp = service.criar(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PostMapping(value = "/importar-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportacaoResultado> importarCsv(@RequestParam("file") MultipartFile file) {
        ImportacaoResultado resp = service.importarCsv(file);
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/{id}")
    public ClienteResponse atualizar(@PathVariable UUID id, @Valid @RequestBody ClienteRequest req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }
}
