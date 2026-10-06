package com.visionbox.modules.fiscal;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.time.OffsetDateTime;

@Entity
@Table(name = "documento_fiscal", uniqueConstraints = @UniqueConstraint(name = "uk_doc_loja_modelo_serie_numero", columnNames = {"loja_id","modelo","serie","numero"}))
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class DocumentoFiscal extends EntidadeBase {

    public enum ModeloFiscal { NFE_55, NFCE_65 }
    public enum StatusFiscal { RASCUNHO, PENDENTE, AUTORIZADO, REJEITADO, CANCELADO, CONTINGENCIA, INUTILIZADO, DENEGADO }
    public enum Ambiente { PRODUCAO_1, HOMOLOGACAO_2 }

    @Enumerated(EnumType.STRING)
    @Column(name = "modelo", nullable = false, length = 10)
    private ModeloFiscal modelo;

    @Column(name = "serie", nullable = false, length = 3)
    private String serie;

    @Column(name = "numero", nullable = false)
    private Integer numero;

    @Column(name = "chave_acesso", length = 44)
    private String chaveAcesso;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private StatusFiscal status = StatusFiscal.RASCUNHO;

    @Column(name = "ambiente", nullable = false, length = 1)
    @Builder.Default
    private String ambiente = "2";

    @Column(name = "tp_emis", nullable = false, length = 1)
    @Builder.Default
    private String tpEmis = "1";

    @Column(name = "xml_enviado", columnDefinition = "TEXT")
    private String xmlEnviado;

    @Column(name = "xml_retorno", columnDefinition = "TEXT")
    private String xmlRetorno;

    @Column(name = "protocolo", length = 15)
    private String protocolo;

    @Column(name = "codigo_status", length = 3)
    private String codigoStatus;

    @Column(name = "motivo", length = 500)
    private String motivo;

    @Column(name = "dh_emissao", columnDefinition = "timestamptz")
    private OffsetDateTime dhEmissao;

    @Column(name = "dh_autorizacao", columnDefinition = "timestamptz")
    private OffsetDateTime dhAutorizacao;

    @Column(name = "pedido_id")
    private java.util.UUID pedidoId;

    @Column(name = "ordem_servico_id")
    private java.util.UUID ordemServicoId;

    @PrePersist
    void prePersistDoc() {
        if (this.dhEmissao == null) this.dhEmissao = OffsetDateTime.now();
    }
}
