package com.visionbox.modules.estoque.repository;

import com.visionbox.modules.estoque.domain.Estoque;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EstoqueRepository extends JpaRepository<Estoque, UUID> {

    Optional<Estoque> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<Estoque> findByProdutoIdAndLojaId(UUID produtoId, UUID lojaId);

    Page<Estoque> findAllByLojaId(UUID lojaId, Pageable pageable);

    boolean existsByProdutoIdAndLojaId(UUID produtoId, UUID lojaId);
}
