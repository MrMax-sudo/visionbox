package com.visionbox.modules.producao.domain;

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

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "producao_os")
@SQLRestriction("ativo = true")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ProducaoOS extends EntidadeBase {

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "inicio_producao", columnDefinition = "timestamptz")
    private OffsetDateTime inicioProducao;

    @Column(name = "fim_producao", columnDefinition = "timestamptz")
    private OffsetDateTime fimProducao;

    @Column(name = "cq_aprovado")
    private Boolean cqAprovado;

    @Column(name = "cq_reprovado_motivo", length = 500)
    private String cqReprovadoMotivo;

    @Column(name = "foto_s3_key", length = 512)
    private String fotoS3Key;

    @Column(name = "foto_s3_bucket", length = 255)
    private String fotoS3Bucket;

    @Column(name = "foto_url", length = 2048)
    private String fotoUrl;

    @Column(name = "responsavel_id")
    private UUID responsavelId;

    @Column(name = "responsavel_nome", length = 200)
    private String responsavelNome;

    @Column(name = "observacao", columnDefinition = "text")
    private String observacao;
}