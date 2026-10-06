package com.visionbox.modules.usuario.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class LoginResponse {
    private String accessToken;
    private String refreshToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private long expiresIn; // seconds
    private UsuarioDTO usuario;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UsuarioDTO {
        private UUID id;
        private UUID lojaId;
        private String nome;
        private String email;
        private String perfil;
    }
}
