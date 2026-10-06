package com.visionbox.modules.usuario.controller;

import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.dto.UsuarioResponse;
import com.visionbox.modules.usuario.service.UsuarioService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService service;

    @GetMapping
    public Page<UsuarioResponse> listar(@PageableDefault(size = 20, sort = "nome") Pageable pageable) {
        return service.listar(pageable);
    }

    @PostMapping
    public ResponseEntity<UsuarioResponse> criar(@Valid @RequestBody UsuarioRequest request) {
        UsuarioResponse response = service.criar(request.nome(), request.email(), request.senha(), request.perfil());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public UsuarioResponse atualizar(@PathVariable UUID id, @Valid @RequestBody UsuarioUpdateRequest request) {
        return service.atualizar(id, request.nome(), request.senha(), request.perfil(), request.ativo());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable UUID id) {
        service.desativar(id);
        return ResponseEntity.noContent().build();
    }

    public record UsuarioRequest(
            @NotBlank @Size(min = 2, max = 150) String nome,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 6, max = 120) String senha,
            Perfil perfil
    ) {
    }

    public record UsuarioUpdateRequest(
            @Size(min = 2, max = 150) String nome,
            @Size(min = 6, max = 120) String senha,
            Perfil perfil,
            Boolean ativo
    ) {
    }
}
