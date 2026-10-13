package com.visionbox.modules.modulos.repository;

import com.visionbox.modules.modulos.domain.ModuloConfiguracaoLoja;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório do catálogo de módulos por loja (R1: TODA query com lojaId).
 * <p>
 * Em produção a RLS FORCE (V36) barra qualquer linha fora de app.current_loja_id();
 * o service roda o escopo de tenant alvo antes da transação (ver ModuloTenantScope).
 */
public interface ModuloConfiguracaoLojaRepository extends JpaRepository<ModuloConfiguracaoLoja, UUID> {

    List<ModuloConfiguracaoLoja> findByLojaId(UUID lojaId);

    Optional<ModuloConfiguracaoLoja> findByLojaIdAndModuloCodigo(UUID lojaId, String moduloCodigo);
}
