package com.visionbox.modules.catalogo.repository;

import com.visionbox.modules.catalogo.domain.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CategoriaRepository extends JpaRepository<Categoria, UUID> {
    Optional<Categoria> findByIdAndLojaId(UUID id, UUID lojaId);
}
