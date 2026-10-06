package com.visionbox.modules.usuario.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "nome é obrigatório")
    @Size(min = 2, max = 150, message = "nome deve ter 2-150 caracteres")
    private String nome;

    @NotBlank(message = "email é obrigatório")
    @Email(message = "email inválido")
    private String email;

    @NotBlank(message = "senha é obrigatória")
    @Size(min = 6, max = 100, message = "senha deve ter 6-100 caracteres")
    private String senha;

    // perfil opcional: ADMIN, GERENTE, VENDEDOR, OTICO, etc
    private String perfil;

    // loja opcional: se não informar, usa matriz 000...0001 ou cria nova
    private UUID lojaId;

    @Size(max = 200)
    private String lojaNome;

    @Size(max = 14)
    private String cnpj;
}
