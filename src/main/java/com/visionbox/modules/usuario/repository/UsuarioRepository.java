package com.visionbox.modules.usuario.repository;

import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Page<Usuario> findAllByLojaId(UUID lojaId, Pageable pageable);

    Optional<Usuario> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<Usuario> findByEmailAndLojaId(String email, UUID lojaId);

    Optional<Usuario> findByEmail(String email);

    boolean existsByEmailAndLojaId(String email, UUID lojaId);

    boolean existsByEmail(String email);

    /**
     * Gerentes/administradores ATIVOS de uma loja — usada pela alçada de desconto
     * (P7/D-010): o PIN é a senha BCrypt de um destes usuários. Filtro explícito
     * por {@code ativo=true} porque {@code Usuario} NÃO tem @SQLRestriction (D-004).
     */
    List<Usuario> findByLojaIdAndPerfilInAndAtivoTrue(UUID lojaId, Collection<Perfil> perfis);
}
