package com.visionbox.modules.relatorios.repository;

import com.visionbox.modules.ordemservico.domain.OrdemServico;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * RelatorioBiRepository — consultas agregadas do BI (US16) sobre dados de venda
 * (ordem_servico + produto + conta_receber + evento_os).
 * <p>
 * Multi-tenant (ADR-001): TODA query filtra {@code loja_id} explicitamente via
 * parâmetro (primeira barreira) e o Postgres aplica RLS FORCE + policy
 * loja_isolation (segunda barreira — ver V11). Nenhum {@code findById} sem lojaId.
 * <p>
 * Sem view no banco (ADR-006 D4): os filtros ficam nas tabelas base para o RLS
 * continuar valendo; V30 adiciona apenas índices de suporte.
 * <p>
 * Estende {@code Repository} apenas como marcador — expõe somente os métodos
 * de consulta declarados aqui.
 */
public interface RelatorioBiRepository extends Repository<OrdemServico, UUID> {

    /**
     * Ranking de giro: quantidade vendida (OS que referenciam o produto como
     * armação ou lente) e faturamento por produto, no período, da loja.
     * Exclui OS CANCELADO / DEVOLVIDO_GARANTIA.
     */
    @Query(value = """
            SELECT pr.id            AS produtoId,
                   pr.nome          AS produtoNome,
                   pr.sku           AS sku,
                   pr.tipo_produto  AS tipoProduto,
                   COUNT(*)         AS quantidadeVendida,
                   SUM(pr.preco_venda) AS faturamento
            FROM (
                     SELECT os.armacao_id AS produto_id, os.loja_id, os.criado_em
                     FROM ordem_servico os
                     WHERE os.armacao_id IS NOT NULL
                       AND os.ativo = true
                       AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
                     UNION ALL
                     SELECT os.lente_id AS produto_id, os.loja_id, os.criado_em
                     FROM ordem_servico os
                     WHERE os.lente_id IS NOT NULL
                       AND os.ativo = true
                       AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
                 ) ref
            JOIN produto pr
              ON pr.id = ref.produto_id
             AND pr.ativo = true
            WHERE ref.loja_id = :lojaId
              AND ref.criado_em >= :inicio
              AND ref.criado_em < :fimExclusivo
            GROUP BY pr.id, pr.nome, pr.sku, pr.tipo_produto
            ORDER BY quantidadeVendida DESC, pr.nome ASC
            """,
            countQuery = """
                    SELECT COUNT(*) FROM (
                        SELECT pr.id
                        FROM (
                                 SELECT os.armacao_id AS produto_id, os.loja_id, os.criado_em
                                 FROM ordem_servico os
                                 WHERE os.armacao_id IS NOT NULL
                                   AND os.ativo = true
                                   AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
                                 UNION ALL
                                 SELECT os.lente_id AS produto_id, os.loja_id, os.criado_em
                                 FROM ordem_servico os
                                 WHERE os.lente_id IS NOT NULL
                                   AND os.ativo = true
                                   AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
                             ) ref
                        JOIN produto pr
                          ON pr.id = ref.produto_id
                         AND pr.ativo = true
                        WHERE ref.loja_id = :lojaId
                          AND ref.criado_em >= :inicio
                          AND ref.criado_em < :fimExclusivo
                        GROUP BY pr.id
                    ) total
                    """,
            nativeQuery = true)
    Page<GiroProdutoProjection> rankingGiro(@Param("lojaId") UUID lojaId,
                                            @Param("inicio") OffsetDateTime inicio,
                                            @Param("fimExclusivo") OffsetDateTime fimExclusivo,
                                            Pageable pageable);

    /**
     * Linhas por OS para margem: vendedor = primeiro responsável humano do
     * timeline da OS (evento mais antigo cujo responsavel != 'sistema');
     * receita = soma dos títulos ativos não cancelados; custo = custo unitário
     * de armação + lente. Sem agregação por vendedor aqui — fica no serviço.
     */
    @Query(value = """
            SELECT os.id                    AS osId,
                   COALESCE(vendedor_ev.responsavel, 'sistema') AS vendedor,
                   COALESCE(SUM(cr.valor), 0) AS receita,
                   (COALESCE(pa.custo, 0) + COALESCE(pl.custo, 0)) AS custo
            FROM ordem_servico os
            LEFT JOIN LATERAL (
                SELECT e.responsavel
                FROM evento_os e
                WHERE e.ordem_servico_id = os.id
                  AND e.ativo = true
                  AND e.responsavel IS NOT NULL
                  AND LOWER(e.responsavel) <> 'sistema'
                ORDER BY e.data_hora ASC
                LIMIT 1
            ) vendedor_ev ON true
            LEFT JOIN produto pa
              ON pa.id = os.armacao_id
             AND pa.ativo = true
            LEFT JOIN produto pl
              ON pl.id = os.lente_id
             AND pl.ativo = true
            LEFT JOIN conta_receber cr
              ON cr.ordem_servico_id = os.id
             AND cr.ativo = true
             AND cr.status <> 'CANCELADO'
            WHERE os.loja_id = :lojaId
              AND os.ativo = true
              AND os.criado_em >= :inicio
              AND os.criado_em < :fimExclusivo
              AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
            GROUP BY os.id, vendedor_ev.responsavel, pa.custo, pl.custo
            ORDER BY os.id ASC
            """,
            nativeQuery = true)
    List<MargemOsProjection> dadosMargemPorOs(@Param("lojaId") UUID lojaId,
                                              @Param("inicio") OffsetDateTime inicio,
                                              @Param("fimExclusivo") OffsetDateTime fimExclusivo);

    /**
     * Faturamento por produto para a curva ABC (mesma fonte do giro).
     */
    @Query(value = """
            SELECT pr.id            AS produtoId,
                   pr.nome          AS produtoNome,
                   pr.sku           AS sku,
                   SUM(pr.preco_venda) AS faturamento
            FROM (
                     SELECT os.armacao_id AS produto_id, os.loja_id, os.criado_em
                     FROM ordem_servico os
                     WHERE os.armacao_id IS NOT NULL
                       AND os.ativo = true
                       AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
                     UNION ALL
                     SELECT os.lente_id AS produto_id, os.loja_id, os.criado_em
                     FROM ordem_servico os
                     WHERE os.lente_id IS NOT NULL
                       AND os.ativo = true
                       AND os.status NOT IN ('CANCELADO', 'DEVOLVIDO_GARANTIA')
                 ) ref
            JOIN produto pr
              ON pr.id = ref.produto_id
             AND pr.ativo = true
            WHERE ref.loja_id = :lojaId
              AND ref.criado_em >= :inicio
              AND ref.criado_em < :fimExclusivo
            GROUP BY pr.id, pr.nome, pr.sku
            ORDER BY faturamento DESC, pr.nome ASC
            """,
            nativeQuery = true)
    List<AbcProdutoProjection> faturamentoPorProduto(@Param("lojaId") UUID lojaId,
                                                     @Param("inicio") OffsetDateTime inicio,
                                                     @Param("fimExclusivo") OffsetDateTime fimExclusivo);
}