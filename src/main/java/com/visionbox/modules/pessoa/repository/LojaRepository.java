package com.visionbox.modules.pessoa.repository;

import com.visionbox.modules.pessoa.domain.Loja;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LojaRepository extends JpaRepository<Loja, UUID> {

    Optional<Loja> findByCodigo(String codigo);

    Optional<Loja> findBySubdominio(String subdominio);

    boolean existsByCodigo(String codigo);

    boolean existsBySubdominio(String subdominio);
}
