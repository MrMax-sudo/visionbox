package com.visionbox.modules.pessoa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "loja")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Loja {
    @Id
    private UUID id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String cnpj;

    @Column
    private String telefone;

    @Column
    private String whatsapp;

    @Column(name = "email_contato")
    private String emailContato;

    @Column
    private String endereco;

    @Column
    private String numero;

    @Column
    private String complemento;

    @Column
    private String bairro;

    @Column
    private String cidade;

    @Column
    private String uf;

    @Column
    private String cep;

    @Column
    private String site;

    @Column(name = "logo_url")
    private String logoUrl;
}