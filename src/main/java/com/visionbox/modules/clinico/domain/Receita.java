package com.visionbox.modules.clinico.domain;

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

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "receita")
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Receita extends EntidadeBase {

    @Column(name = "cliente_id", nullable = false)
    private java.util.UUID clienteId;

    @Column(name = "data_emissao", nullable = false)
    private LocalDate dataEmissao;

    @Column(name = "data_validade", nullable = false)
    private LocalDate dataValidade;

    @Column(name = "nome_medico", length = 150)
    private String nomeMedico;

    @Column(name = "crm_medico", length = 20)
    private String crmMedico;

    // OD
    @Column(name = "od_esferico", precision = 5, scale = 2)
    private BigDecimal odEsferico;
    @Column(name = "od_cilindrico", precision = 5, scale = 2)
    private BigDecimal odCilindrico;
    @Column(name = "od_eixo")
    private Integer odEixo;
    @Column(name = "od_adicao", precision = 4, scale = 2)
    private BigDecimal odAdicao;
    @Column(name = "od_dnp", precision = 4, scale = 1)
    private BigDecimal odDnp;
    @Column(name = "od_cipher", columnDefinition = "bytea")
    private byte[] odCipher;

    // OE
    @Column(name = "oe_esferico", precision = 5, scale = 2)
    private BigDecimal oeEsferico;
    @Column(name = "oe_cilindrico", precision = 5, scale = 2)
    private BigDecimal oeCilindrico;
    @Column(name = "oe_eixo")
    private Integer oeEixo;
    @Column(name = "oe_adicao", precision = 4, scale = 2)
    private BigDecimal oeAdicao;
    @Column(name = "oe_dnp", precision = 4, scale = 1)
    private BigDecimal oeDnp;
    @Column(name = "oe_cipher", columnDefinition = "bytea")
    private byte[] oeCipher;

    @Column(name = "dp", precision = 4, scale = 1)
    private BigDecimal dp;

    @Column(name = "tipo", length = 20, nullable = false)
    @lombok.Builder.Default
    private String tipo = "VISAO_SIMPLES";

    @Column(name = "observacao", length = 500)
    private String observacao;

    @Column(name = "anexo_s3_key", length = 500)
    private String anexoS3Key;

    @Column(name = "anexo_s3_bucket", length = 100)
    private String anexoS3Bucket;
}
