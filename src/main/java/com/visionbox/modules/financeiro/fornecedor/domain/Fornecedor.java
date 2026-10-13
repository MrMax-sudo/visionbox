package com.visionbox.modules.financeiro.fornecedor.domain;

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

/**
 * Fornecedor/credor da ótica (labs, distribuidores de armações, despesas fixas).
 * CNPJ cifrado AES-256-GCM + HMAC (cnpj_cipher/cnpj_hash) — mesmo padrão do CPF do
 * Cliente (ADR-002/R2). Dedup parcial por (loja_id, cnpj_hash) — V34.
 */
@Entity
@Table(name = "fornecedor")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Fornecedor extends EntidadeBase {

    @Column(name = "nome", nullable = false, length = 200)
    private String nome;

    /** CNPJ cifrado (AES-GCM) — nunca em plain (LGPD/ADR-002). */
    @Column(name = "cnpj_cipher", columnDefinition = "bytea")
    private byte[] cnpjCipher;

    /** HMAC-SHA256 do CNPJ — dedup por loja sem decifrar. */
    @Column(name = "cnpj_hash", length = 64)
    private String cnpjHash;

    @Column(name = "contato", length = 120)
    private String contato;

    @Column(name = "telefone", length = 20)
    private String telefone;

    @Column(name = "email", length = 255)
    private String email;
}
