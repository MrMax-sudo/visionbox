package com.visionbox.modules.pessoa.empresaconfig.dto;

import com.visionbox.modules.pessoa.domain.Loja;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmpresaResponse {
    private UUID id;
    private String nome;
    private String cnpj;
    private String telefone;
    private String whatsapp;
    private String emailContato;
    private String endereco;
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    private String uf;
    private String cep;
    private String site;
    private String logoUrl;

    public static EmpresaResponse from(Loja loja) {
        return EmpresaResponse.builder()
                .id(loja.getId())
                .nome(loja.getNome())
                .cnpj(loja.getCnpj())
                .telefone(loja.getTelefone())
                .whatsapp(loja.getWhatsapp())
                .emailContato(loja.getEmailContato())
                .endereco(loja.getEndereco())
                .numero(loja.getNumero())
                .complemento(loja.getComplemento())
                .bairro(loja.getBairro())
                .cidade(loja.getCidade())
                .uf(loja.getUf())
                .cep(loja.getCep())
                .site(loja.getSite())
                .logoUrl(loja.getLogoUrl())
                .build();
    }
}