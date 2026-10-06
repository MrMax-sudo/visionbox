package com.visionbox.shared.domain;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * EntidadeBase — foundation S0-01.
 * <p>
 * Regras:
 * - UUID gen_random_uuid() no Postgres (GenerationType.UUID)
 * - loja_id NOT NULL + @TenantId para isolamento multi-tenant (ADR-001 shared database)
 * - timestamptz OffsetDateTime (criadoEm/atualizadoEm)
 * - @Version para lock otimista (409)
 * - ativo soft-delete com @SQLRestriction("ativo = true") nas entidades concretas
 * - equals/hashCode por id quando persistido
 *
 * @see com.visionbox.shared.base.EntidadeBase compat alias
 */
@Getter
@Setter
@MappedSuperclass
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public abstract class EntidadeBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /**
     * Discriminador de tenant. Nunca nulo, nunca atualizável.
     * Dev: coluna comum (TenantFilter manual). Prod: @TenantId + RLS (ADR-001).
     * TODA tabela operacional deve ter loja_id; repositórios SEM loja_id são bug bloqueante (R1).
     */
    @Column(name = "loja_id", nullable = false, updatable = false)
    private UUID lojaId;

    @Column(name = "criado_em", nullable = false, updatable = false, columnDefinition = "timestamptz")
    private OffsetDateTime criadoEm;

    @Column(name = "atualizado_em", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime atualizadoEm;

    @Version
    @Column(name = "versao", nullable = false)
    private Long versao;

    @lombok.Builder.Default
    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    @PrePersist
    protected void prePersist() {
        OffsetDateTime agora = OffsetDateTime.now();
        if (this.criadoEm == null) {
            this.criadoEm = agora;
        }
        if (this.atualizadoEm == null) {
            this.atualizadoEm = agora;
        }
        if (this.versao == null) {
            this.versao = 0L;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        this.atualizadoEm = OffsetDateTime.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EntidadeBase that = (EntidadeBase) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
