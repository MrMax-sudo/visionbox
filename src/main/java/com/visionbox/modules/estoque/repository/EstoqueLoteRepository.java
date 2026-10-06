package com.visionbox.modules.estoque.repository;

import com.visionbox.modules.estoque.domain.EstoqueLote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EstoqueLoteRepository extends JpaRepository<EstoqueLote, UUID> {

    Optional<EstoqueLote> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<EstoqueLote> findByLojaIdAndProdutoIdAndLote(UUID lojaId, UUID produtoId, String lote);

    Page<EstoqueLote> findAllByLojaId(UUID lojaId, Pageable pageable);

    List<EstoqueLote> findByLojaIdAndProdutoId(UUID lojaId, UUID produtoId);

    List<EstoqueLote> findByLojaIdAndValidadeBefore(UUID lojaId, LocalDate data);

    List<EstoqueLote> findByLojaIdAndBloqueadoTrue(UUID lojaId);

    boolean existsByLojaIdAndProdutoIdAndLote(UUID lojaId, UUID produtoId, String lote);
}
