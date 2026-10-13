package com.visionbox.modules.compras.repository;

import com.visionbox.modules.compras.domain.Compra;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CompraRepository extends JpaRepository<Compra, UUID> {

    Optional<Compra> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<Compra> findAllByLojaId(UUID lojaId, Pageable pageable);

    /** Idempotência da importação: a mesma chave de acesso não entra duas vezes na loja. */
    boolean existsByLojaIdAndChaveAcessoAndAtivoTrue(UUID lojaId, String chaveAcesso);

    /** Detalhe com itens fetch-join (evita N+1). */
    @Query("""
            select distinct c from Compra c
              left join fetch c.itens
             where c.lojaId = :lojaId and c.id = :id
            """)
    Optional<Compra> findByIdComItens(@Param("id") UUID id, @Param("lojaId") UUID lojaId);
}
