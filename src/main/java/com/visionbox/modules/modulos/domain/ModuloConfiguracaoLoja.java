package com.visionbox.modules.modulos.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
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
 * ModuloConfiguracaoLoja — flag de ativação de módulo por loja (spec §4, R11).
 * <p>
 * Uma linha por (loja_id, modulo_codigo). Tabela {@code modulo_configuracao_loja} (V36).
 * <p>
 * <b>Não estende {@code EntidadeBase} de propósito:</b> a coluna {@code ativo} desta tabela é
 * o FLAG DE NEGÓCIO da spec ("módulo ativo na loja"), enquanto no {@code EntidadeBase}
 * {@code ativo} é soft-delete (+ {@code @SQLRestriction("ativo = true")}). Herdar misturaria as
 * semânticas e esconderia módulos desligados da listagem. Os demais campos replicam o padrão
 * da base (UUID, loja_id, timestamptz, @Version).
 */
@Entity
@Table(name = "modulo_configuracao_loja")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ModuloConfiguracaoLoja {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "loja_id", nullable = false, updatable = false)
    private UUID lojaId;

    /** Código do enum {@link ModuloSistema} (VARCHAR(40) com CHECK na migration). */
    @Column(name = "modulo_codigo", nullable = false, length = 40)
    private String moduloCodigo;

    /** Flag de negócio: módulo liberado para esta loja. */
    @Column(name = "ativo", nullable = false)
    private boolean ativo;

    /** Plano que concedeu o módulo (START/PRO/ENTERPRISE/PERSONALIZADO/PADRAO). */
    @Column(name = "plano_nome", length = 30)
    private String planoNome;

    @Column(name = "criado_em", nullable = false, updatable = false, columnDefinition = "timestamptz")
    private OffsetDateTime criadoEm;

    @Column(name = "atualizado_em", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime atualizadoEm;

    @Version
    @Column(name = "versao", nullable = false)
    private Long versao;

    @PrePersist
    protected void prePersist() {
        OffsetDateTime agora = OffsetDateTime.now();
        if (criadoEm == null) {
            criadoEm = agora;
        }
        if (atualizadoEm == null) {
            atualizadoEm = agora;
        }
        if (versao == null) {
            versao = 0L;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        atualizadoEm = OffsetDateTime.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ModuloConfiguracaoLoja that = (ModuloConfiguracaoLoja) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
