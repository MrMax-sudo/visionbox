package com.visionbox.modules.vendas.repository;

import com.visionbox.modules.vendas.domain.PedidoVenda;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PedidoVendaRepository extends JpaRepository<PedidoVenda, UUID> {
    Optional<PedidoVenda> findByIdAndLojaId(UUID id, UUID lojaId);
    Page<PedidoVenda> findAllByLojaId(UUID lojaId, Pageable pageable);
    Optional<PedidoVenda> findByNumeroAndLojaId(String numero, UUID lojaId);
}
