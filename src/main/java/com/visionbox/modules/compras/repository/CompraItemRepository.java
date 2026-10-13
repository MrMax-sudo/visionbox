package com.visionbox.modules.compras.repository;

import com.visionbox.modules.compras.domain.CompraItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CompraItemRepository extends JpaRepository<CompraItem, UUID> {

    List<CompraItem> findByCompraIdAndLojaId(UUID compraId, UUID lojaId);
}
