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

    /**
     * Listagem do catálogo com busca textual e/ou filtro de categoria/marca (contrato do frontend:
     * GET /api/v1/produtos?q=|search=&categoria=&marca=).
     * <p>
     * Os parâmetros opcionais também aparecem em comparações tipadas (concat/enum), então o
     * Hibernate 6 consegue inferir o tipo mesmo quando o valor é {@code null}.
     *
     * @param categoria coluna texto {@code produto.categoria} (case-insensitive); null = sem filtro
     * @param tipo      enum {@code tipo_produto} (sempre preenchido no domínio); null = sem filtro
     * @param marca     coluna texto {@code produto.marca} (case-insensitive, contains); null = sem filtro
     */
    @Query("""
            select p from Produto p
             where p.lojaId = :lojaId
               and (:q is null
                    or lower(p.nome) like lower(concat('%', :q, '%'))
                    or lower(p.sku) like lower(concat('%', :q, '%'))
                    or (p.codigoBarras is not null and lower(p.codigoBarras) like lower(concat('%', :q, '%'))))
               and (:categoria is null or lower(p.categoria) = lower(:categoria))
               and (:tipo is null or p.tipoProduto = :tipo)
               and (:marca is null or (p.marca is not null and lower(p.marca) like lower(concat('%', :marca, '%'))))
            """)
    Page<Produto> buscarFiltrado(@Param("lojaId") UUID lojaId,
                                 @Param("q") String q,
                                 @Param("categoria") String categoria,
                                 @Param("tipo") Produto.TipoProduto tipo,
                                 @Param("marca") String marca,
                                 Pageable pageable);
}
