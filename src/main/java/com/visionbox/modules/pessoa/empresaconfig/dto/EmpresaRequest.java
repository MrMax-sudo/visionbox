package com.visionbox.modules.pessoa.empresaconfig.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmpresaRequest {

    @NotBlank(message = "Nome da empresa é obrigatório")
    @Size(max = 200)
    private String nome;

    @Size(max = 14, message = "CNPJ deve ter até 14 dígitos")
    private String cnpj;

    @Size(max = 20)
    private String telefone;

    @Size(max = 20)
    private String whatsapp;

    @Size(max = 200)
    private String emailContato;

    @Size(max = 255)
    private String endereco;

    @Size(max = 20)
    private String numero;

    @Size(max = 120)
    private String complemento;

    @Size(max = 120)
    private String bairro;

    @Size(max = 120)
    private String cidade;

    @Size(max = 2, message = "UF deve ter 2 letras")
    private String uf;

    @Size(max = 8)
    private String cep;

    @Size(max = 255)
    private String site;

    @Size(max = 500)
    private String logoUrl;
}