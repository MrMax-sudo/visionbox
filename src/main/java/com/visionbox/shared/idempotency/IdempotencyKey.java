package com.visionbox.shared.idempotency;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLRestriction;

import java.time.OffsetDateTime;

/**
 * IdempotencyKey — PDV botão Finalizar sempre ativo offline (R4).
 * <p>
 * Cliente envia header Idempotency-Key (UUID v4). Servidor armazena
 * hash da requisição + resposta para replay idempotente 24h.
 * <p>
 * UNIQUE(loja_id, chave) — isolamento por tenant.
 * TTL 24h + coluna expira_em para limpeza por Quartz.
 * Lock otimista @Version evita race em duplo clique PDV.
 */
@Entity
@Table(name = "idempotency_key", uniqueConstraints = {
        @UniqueConstraint(name = "uk_idempotency_loja_chave", columnNames = {"loja_id", "chave"})
})
@SQLRestriction("ativo = true")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class IdempotencyKey extends EntidadeBase {

    @Column(name = "chave", nullable = false, length = 64)
    private String chave;

    @Column(name = "metodo", nullable = false, length = 10)
    private String metodo;

    @Column(name = "path", nullable = false, length = 500)
    private String path;

    @Column(name = "request_hash", length = 128)
    private String requestHash;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "response_body", columnDefinition = "text")
    private String responseBody;

    @Column(name = "response_content_type", length = 100)
    private String responseContentType;

    @Column(name = "expira_em", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime expiraEm;

    // helper
    public boolean isExpirado() {
        return expiraEm != null && OffsetDateTime.now().isAfter(expiraEm);
    }

    public boolean isProcessado() {
        return statusCode != null;
    }
}
