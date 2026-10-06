package com.visionbox.modules.pessoa.dto;

import com.visionbox.shared.validation.Cpf;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ClienteRequest {

    @NotBlank(message = "nome é obrigatório")
    @Size(min = 2, max = 150)
    private String nome;

    // CPF opcional; se informado deve ter 11 dígitos (com ou sem máscara); validação Bean + service + HMAC dedup
    @Pattern(regexp = "^$|^[0-9\\.\\-]{11,14}$", message = "CPF inválido")
    @Cpf(message = "CPF inválido")
    private String cpf;

    @Size(max = 20)
    private String telefone;

    @Size(max = 20)
    private String whatsapp;

    @Email
    @Size(max = 255)
    private String email;

    private String dataNascimento; // ISO yyyy-MM-dd opcional

    @Size(max = 8)
    private String cep;
    private String logradouro;
    @Size(max = 20)
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    @Pattern(regexp = "^$|^[A-Z]{2}$", message = "UF deve ter 2 letras maiúsculas")
    private String uf;

    private Boolean consentimentoRecall;
    private String canalPreferido;
}
