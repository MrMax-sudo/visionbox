package com.visionbox.modules.pessoa.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ClienteResponse {
    private UUID id;
    private UUID lojaId;
    private String nome;
    private String cpfMasked; // "***.***.***-**" ou null se não houver CPF
    private String telefone;
    private String whatsapp;
    private String email;
    private String dataNascimento;
    private String cep;
    private String logradouro;
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    private String uf;
    private Boolean consentimentoRecall;
    private String canalPreferido;
    private boolean ativo;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;
}
