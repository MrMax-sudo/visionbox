package com.visionbox.modules.financeiro.fornecedor.repository;

import com.visionbox.modules.financeiro.fornecedor.domain.Fornecedor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

/**
 * Repositório de Fornecedor — multi-tenant por loja_id (R1/ADR-001).
 * <p>
 * A entidade tem {@code @SQLRestriction("ativo = true")}: fornecedores inativos
 * (soft-delete) são INVISÍVEIS às queries derivadas. A reativação (§3.3) e o
 * toggle "Mostrar inativos" do painel precisam enxergá-los — por isso usamos
 * queries NATIVAS, que não recebem a restrição. Todas seguem escopando
 * {@code loja_id} explicitamente (R1): linha de outra loja → 0 linhas → 404,
 * sem vazar existência. RLS FORCE da V34 continua aplicado (fail-closed).
 */
public interface FornecedorRepository extends JpaRepository<Fornecedor, UUID> {

    Optional<Fornecedor> findByIdAndLojaId(UUID id, UUID lojaId);

    Page<Fornecedor> findAllByLojaId(UUID lojaId, Pageable pageable);

    Page<Fornecedor> findByLojaIdAndNomeContainingIgnoreCase(UUID lojaId, String nome, Pageable pageable);

    boolean existsByCnpjHashAndLojaId(String cnpjHash, UUID lojaId);

    /**
     * Reativação (R1): a linha existe INCLUSIVE se inativa? Native bypass do
     * @SQLRestriction. Id de outra loja → false → 404 (não vaza existência).
     */
    @Query(value = "SELECT COUNT(*) > 0 FROM fornecedor WHERE id = :id AND loja_id = :lojaId", nativeQuery = true)
    boolean existsByIdAndLojaIdInclusive(@Param("id") UUID id, @Param("lojaId") UUID lojaId);

    /**
     * Reativação (R1): cnpj_hash do fornecedor (native bypass do @SQLRestriction).
     * Optional VAZIO quando a linha não existe OU o CNPJ não foi cadastrado — a
     * existência é verificada antes por {@link #existsByIdAndLojaIdInclusive}.
     * Sem projeção de entidade: só o hash necessário ao check de conflito.
     */
    @Query(value = "SELECT cnpj_hash FROM fornecedor WHERE id = :id AND loja_id = :lojaId", nativeQuery = true)
    Optional<String> findCnpjHashByIdAndLojaIdInclusive(@Param("id") UUID id, @Param("lojaId") UUID lojaId);

    /**
     * Soft-delete reversal: UPDATE nativo setando ativo=true APENAS na linha da loja
     * (R1) e ainda inativa. Não toca cnpj_cipher/cnpj_hash — cifra permanece intacta
     * (ADR-002). Retorna 1 (reativado) ou 0 (inexistente, outra loja ou já ativo).
     */
    @Modifying
    @Query(value = "UPDATE fornecedor SET ativo = true, atualizado_em = now() "
            + "WHERE id = :id AND loja_id = :lojaId AND ativo = false", nativeQuery = true)
    int reativarByIdAndLojaId(@Param("id") UUID id, @Param("lojaId") UUID lojaId);

    /**
     * Listagem incluindo inativos (toggle "Mostrar inativos" do painel) — native
     * bypass do @SQLRestriction com paginação. {@code nome} opcional: CAST garante
     * inferência de tipo text no PostgreSQL quando o parâmetro vem nulo.
     */
    @Query(value = "SELECT * FROM fornecedor WHERE loja_id = :lojaId "
            + "AND (CAST(:nome AS text) IS NULL OR nome ILIKE '%' || CAST(:nome AS text) || '%')",
           countQuery = "SELECT count(*) FROM fornecedor WHERE loja_id = :lojaId "
            + "AND (CAST(:nome AS text) IS NULL OR nome ILIKE '%' || CAST(:nome AS text) || '%')",
           nativeQuery = true)
    Page<Fornecedor> findAllByLojaIdInclusive(@Param("lojaId") UUID lojaId,
                                              @Param("nome") String nome,
                                              Pageable pageable);
}
