package com.visionbox.modules.fiscal;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;

/**
 * TributacaoRegra — parametrização tributária NCM + UF + CRT conforme ADR-004.
 * <p>
 * Regra de ouro: nunca hard-code alíquota; toda tributação vem de tributacao_regra(NCM+UF+CRT).
 * <p>
 * Para CRT 1 Simples Nacional → CSOSN 102 (sem destaque ICMS, tributação monofásica ou isenta).
 * Para CRT 3 Lucro Presumido/Real → CST 00/40/60 com alíquota.
 * <p>
 * Seed MVP: NCM 90031100 (armação) e 90015000 (lente oftálmica) com CRT 1 CSOSN 102 CFOP 5102.
 * Divergências entre UF documentadas: ICMS-ST difere por convênio, mas CSOSN 102 isenta é uniforme para Simples.
 * Em contingência ou sem regra específica retorna CSOSN 102 por default para ótica Simples.
 */
@Entity
@Table(name = "tributacao_regra",
       uniqueConstraints = @UniqueConstraint(name = "uk_tributacao_ncm_crt_uf_cfop",
                                              columnNames = {"loja_id","ncm","crt","uf_origem","cfop"}))
@SQLRestriction("ativo = true")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class TributacaoRegra extends EntidadeBase {

    @Column(name = "uf_origem", length = 2)
    private String ufOrigem;

    @Column(name = "uf_destino", length = 2)
    private String ufDestino;

    @Column(name = "ncm", length = 8, nullable = false)
    private String ncm;

    /** CRT: 1 Simples Nacional, 2 Simples excesso, 3 Regime Normal */
    @Column(name = "crt", length = 1, nullable = false)
    private String crt;

    @Column(name = "cfop", length = 4)
    private String cfop;

    /** CSOSN para CRT 1 (102, 103, 500, 400); CST para CRT 3 (00, 40, 60) */
    @Column(name = "csosn", length = 3)
    private String csosn;

    @Column(name = "cst", length = 3)
    private String cst;

    @Column(name = "aliquota", precision = 5, scale = 2)
    private BigDecimal aliquota;

    @Column(name = "cbenef", length = 10)
    private String cbenef;

    @Column(name = "descricao", length = 500)
    private String descricao;
}
