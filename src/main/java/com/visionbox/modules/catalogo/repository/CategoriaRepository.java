package com.visionbox.modules.catalogo.repository;

import com.visionbox.modules.catalogo.domain.Categoria;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoriaRepository extends JpaRepository<Categoria, UUID> {

    Optional<Categoria> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<Categoria> findAllByLojaId(UUID lojaId, Pageable pageable);

    @Query("SELECT c FROM Categoria c WHERE c.lojaId = :lojaId AND (:termo IS NULL OR LOWER(c.nome) LIKE LOWER(CONCAT('%', :termo, '%'))) ORDER BY c.nome ASC")
    Page<Categoria> buscarFiltrado(@Param("lojaId") UUID lojaId, @Param("termo") String termo, Pageable pageable);

    List<Categoria> findAllByLojaIdOrderByNomeAsc(UUID lojaId);

    Optional<Categoria> findByLojaIdAndNomeIgnoreCase(UUID lojaId, String nome);

    boolean existsByLojaIdAndNomeIgnoreCase(UUID lojaId, String nome);

    boolean existsByLojaIdAndNomeIgnoreCaseAndIdNot(UUID lojaId, String nome, UUID id);
}
