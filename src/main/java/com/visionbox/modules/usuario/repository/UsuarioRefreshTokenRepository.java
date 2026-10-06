package com.visionbox.modules.usuario.repository;

import com.visionbox.modules.usuario.domain.UsuarioRefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface UsuarioRefreshTokenRepository extends JpaRepository<UsuarioRefreshToken, UUID> {

    Optional<UsuarioRefreshToken> findByJtiHashAndLojaId(String jtiHash, UUID lojaId);

    @Modifying
    @Query("""
            update UsuarioRefreshToken t
               set t.revokedAt = :revokedAt
             where t.lojaId = :lojaId
               and t.usuarioId = :usuarioId
               and t.revokedAt is null
            """)
    int revokeAllActiveForUser(@Param("lojaId") UUID lojaId,
                               @Param("usuarioId") UUID usuarioId,
                               @Param("revokedAt") OffsetDateTime revokedAt);
}
