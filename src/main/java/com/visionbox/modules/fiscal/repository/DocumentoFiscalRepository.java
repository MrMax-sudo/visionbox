package com.visionbox.modules.fiscal.repository;

import com.visionbox.modules.fiscal.DocumentoFiscal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface DocumentoFiscalRepository extends JpaRepository<DocumentoFiscal, UUID> {

    Optional<DocumentoFiscal> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<DocumentoFiscal> findByChaveAcessoAndLojaId(String chave, UUID lojaId);

    Page<DocumentoFiscal> findAllByLojaId(UUID lojaId, Pageable pageable);

    Optional<DocumentoFiscal> findByLojaIdAndModeloAndSerieAndNumero(UUID lojaId, DocumentoFiscal.ModeloFiscal modelo, String serie, Integer numero);

    /**
     * Maior número já usado na série no mesmo ambiente: base da sequência max+1 que substituiu o
     * gerador aleatório (V48). Séries vazias devolvem vazio e vale o número inicial da loja.
     */
    @Query("SELECT MAX(d.numero) FROM DocumentoFiscal d WHERE d.lojaId = :lojaId "
            + "AND d.modelo = :modelo AND d.serie = :serie AND d.ambiente = :ambiente")
    Optional<Integer> maiorNumeroDaSerie(@Param("lojaId") UUID lojaId,
                                         @Param("modelo") DocumentoFiscal.ModeloFiscal modelo,
                                         @Param("serie") String serie,
                                         @Param("ambiente") String ambiente);

    Optional<DocumentoFiscal> findFirstByOrdemServicoIdAndLojaIdOrderByCriadoEmDesc(UUID ordemServicoId, UUID lojaId);

    java.util.List<DocumentoFiscal> findAllByLojaIdAndOrdemServicoIdIn(UUID lojaId, java.util.Collection<UUID> ordemServicoIds);

    Optional<DocumentoFiscal> findFirstByPedidoIdAndLojaIdOrderByCriadoEmDesc(UUID pedidoId, UUID lojaId);

    // Métricas: documentos em contingência aguardando sincronização (Fisco — NFC-e/SAT-CF-e)
    long countByStatus(DocumentoFiscal.StatusFiscal status);
}
