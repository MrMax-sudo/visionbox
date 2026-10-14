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

    @Column(name = "flowbox_url")
    private String flowboxUrl;

    @Column(name = "flowbox_api_key")
    private String flowboxApiKey;

    @Column(name = "flowbox_web_url")
    private String flowboxWebUrl;

    /** Id do certificado A1 cadastrado no Flowbox — o PFX nunca trafega (R9/ADR-004). */
    @Column(name = "flowbox_certificado_id")
    private Long flowboxCertificadoId;

    /**
     * Inscrição Estadual real do emitente na SEFAZ da UF. Obrigatória: a SEFAZ rejeita a
     * emissão com cStat 209 quando ela diverge do cadastro do CNPJ.
     */
    @Column(name = "inscricao_estadual", length = 20)
    private String inscricaoEstadual;

    /** CSC (Código de Segurança do Contribuinte) da NFC-e, emitido no portal da NF-e da UF. */
    @Column(length = 64)
    private String csc;

    /** Id do CSC no portal da NF-e. Sai sem zero à esquerda no XML do QR Code. */
    @Column(name = "csc_id", length = 6)
    private String cscId;

    /** Código IBGE de 7 dígitos do município de emissão (cMunFG). */
    @Column(name = "codigo_municipio", length = 7)
    private String codigoMunicipio;

    /** Código de Regime Tributário: 1 Simples Nacional, 2 Lucro Presumido, 3 Lucro Real. */
    @Column(length = 1)
    private String crt;

    /** Ambiente da SEFAZ usado na emissão: HOMOLOGACAO ou PRODUCAO. */
    @Column(name = "fiscal_ambiente", length = 20)
    private String fiscalAmbiente;

    /** Série da NFC-e (modelo 65) usada na emissão; configurável por loja (V48). */
    @Column(name = "fiscal_serie_nfce", length = 3)
    private String fiscalSerieNfce;

    /** Série da NF-e (modelo 55) usada na emissão; configurável por loja (V48). */
    @Column(name = "fiscal_serie_nfe", length = 3)
    private String fiscalSerieNfe;

    /** Primeiro número da série da NFC-e quando a série ainda não tem documentos. */
    @Column(name = "fiscal_numero_inicial_nfce")
    private Integer fiscalNumeroInicialNfce;

    /** Primeiro número da série da NF-e quando a série ainda não tem documentos. */
    @Column(name = "fiscal_numero_inicial_nfe")
    private Integer fiscalNumeroInicialNfe;
}