package com.visionbox.modules.catalogo.repository;

import com.visionbox.modules.catalogo.domain.Produto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ProdutoRepository extends JpaRepository<Produto, UUID> {

    Optional<Produto> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<Produto> findBySkuAndLojaId(String sku, UUID lojaId);

    boolean existsBySkuAndLojaId(String sku, UUID lojaId);

    Page<Produto> findAllByLojaId(UUID lojaId, Pageable pageable);

    @Query("select p from Produto p where p.lojaId = :lojaId and (lower(p.nome) like lower(concat('%', :q, '%')) or lower(p.sku) like lower(concat('%', :q, '%')) or lower(p.codigoBarras) like lower(concat('%', :q, '%')) )")
    Page<Produto> search(@Param("lojaId") UUID lojaId, @Param("q") String q, Pageable pageable);
}
