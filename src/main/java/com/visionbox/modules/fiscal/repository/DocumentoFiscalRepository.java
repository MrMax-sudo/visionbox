package com.visionbox.modules.fiscal.repository;

import com.visionbox.modules.fiscal.DocumentoFiscal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DocumentoFiscalRepository extends JpaRepository<DocumentoFiscal, UUID> {

    Optional<DocumentoFiscal> findByIdAndLojaId(UUID id, UUID lojaId);

    Optional<DocumentoFiscal> findByChaveAcessoAndLojaId(String chave, UUID lojaId);

    Page<DocumentoFiscal> findAllByLojaId(UUID lojaId, Pageable pageable);

    Optional<DocumentoFiscal> findByLojaIdAndModeloAndSerieAndNumero(UUID lojaId, DocumentoFiscal.ModeloFiscal modelo, String serie, Integer numero);

    // Métricas: documentos em contingência aguardando sincronização (Fisco — NFC-e/SAT-CF-e)
    long countByStatus(DocumentoFiscal.StatusFiscal status);
}
