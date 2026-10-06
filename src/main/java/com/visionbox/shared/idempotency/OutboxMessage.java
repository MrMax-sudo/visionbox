package com.visionbox.shared.idempotency;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/**
 * OutboxMessage — pattern outbox para mensageria confiável + fiscal contingência.
 * <p>
 * Transação local grava evento em outbox_message com status PENDING.
 * Publisher Quartz/Rabbit lê, publica, marca SENT. Se falhar, incrementa tentativas
 * e agenda proximaTentativa com backoff exponencial.
 * <p>
 * Também usado para NFC-e/SAT-CF-e em contingência offline: emissão é gravada
 * offline, sincroniza quando rede volta (arquivo.md §13). Nunca perde venda.
 */
@Entity
@Table(name = "outbox_message")
@SQLRestriction("ativo = true")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class OutboxMessage extends EntidadeBase {

    public enum Status {
        PENDING,
        SENT,
        FAILED
    }

    @Column(name = "aggregate_type", nullable = false, length = 100)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, length = 36)
    private String aggregateId;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "headers", columnDefinition = "jsonb")
    private String headers;

    @lombok.Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    @lombok.Builder.Default
    @Column(name = "tentativas", nullable = false)
    private int tentativas = 0;

    @Column(name = "proxima_tentativa", columnDefinition = "timestamptz")
    private OffsetDateTime proximaTentativa;

    @Column(name = "enviado_em", columnDefinition = "timestamptz")
    private OffsetDateTime enviadoEm;

    @Column(name = "erro_ultimo", columnDefinition = "text")
    private String erroUltimo;

    public void markSent() {
        this.status = Status.SENT;
        this.enviadoEm = OffsetDateTime.now();
        this.erroUltimo = null;
    }

    public void markFailed(String erro, OffsetDateTime proxima) {
        this.status = Status.FAILED;
        this.erroUltimo = erro;
        this.proximaTentativa = proxima;
        this.tentativas++;
    }

    public boolean isPending() {
        return status == Status.PENDING || status == Status.FAILED;
    }
}
