package com.visionbox.modules.usuario.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UsuarioResponse {
    private UUID id;
    private UUID lojaId;
    private String nome;
    private String email;
    private String perfil;
    private OffsetDateTime criadoEm;
    private boolean ativo;
}
