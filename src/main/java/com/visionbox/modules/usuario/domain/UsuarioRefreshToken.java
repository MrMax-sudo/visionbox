package com.visionbox.modules.usuario.domain;

import com.visionbox.shared.domain.EntidadeBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "usuario_refresh_token", indexes = {
        @Index(name = "idx_usuario_refresh_jti_hash", columnList = "jti_hash"),
        @Index(name = "idx_usuario_refresh_usuario", columnList = "loja_id, usuario_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class UsuarioRefreshToken extends EntidadeBase {

    @Column(name = "usuario_id", nullable = false)
    private UUID usuarioId;

    @Column(name = "jti_hash", nullable = false, length = 64, unique = true)
    private String jtiHash;

    @Column(name = "expires_at", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at", columnDefinition = "timestamptz")
    private OffsetDateTime revokedAt;

    @Column(name = "replaced_by_jti_hash", length = 64)
    private String replacedByJtiHash;

    @Column(name = "last_used_at", columnDefinition = "timestamptz")
    private OffsetDateTime lastUsedAt;

    public boolean isUsable(OffsetDateTime now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }
}
