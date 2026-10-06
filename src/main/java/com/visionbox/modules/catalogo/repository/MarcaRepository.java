package com.visionbox.modules.catalogo.repository;

import com.visionbox.modules.catalogo.domain.Marca;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MarcaRepository extends JpaRepository<Marca, UUID> {
    Optional<Marca> findByIdAndLojaId(UUID id, UUID lojaId);
    boolean existsByNomeAndLojaId(String nome, UUID lojaId);
}
