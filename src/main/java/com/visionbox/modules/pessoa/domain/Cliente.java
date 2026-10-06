package com.visionbox.modules.pessoa.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDate;

@Entity
@Table(name = "cliente")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Cliente extends EntidadeBase {

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(name = "cpf_cipher", columnDefinition = "bytea")
    private byte[] cpfCipher;

    @Column(name = "cpf_hash", length = 64)
    private String cpfHash;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Column(name = "telefone", length = 20)
    private String telefone;

    @Column(name = "whatsapp", length = 20)
    private String whatsapp;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "canal_preferido", length = 20)
    @lombok.Builder.Default
    private String canalPreferido = "WHATSAPP";

    @Column(name = "cep", length = 8)
    private String cep;

    @Column(name = "logradouro")
    private String logradouro;

    @Column(name = "numero", length = 20)
    private String numero;

    @Column(name = "complemento", length = 100)
    private String complemento;

    @Column(name = "bairro", length = 100)
    private String bairro;

    @Column(name = "cidade", length = 100)
    private String cidade;

    @Column(name = "uf", length = 2)
    private String uf;

    @Column(name = "consentimento_recall")
    @lombok.Builder.Default
    private boolean consentimentoRecall = false;

    @Column(name = "score_recompra")
    private Integer scoreRecompra;
}
