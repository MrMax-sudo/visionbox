package com.visionbox.modules.estoque.mapper;

import com.visionbox.modules.estoque.domain.Estoque;
import com.visionbox.modules.estoque.dto.EstoqueResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface EstoqueMapper {

    default EstoqueResponse toResponse(Estoque e) {
        if (e == null) return null;
        return EstoqueResponse.builder()
                .id(e.getId())
                .lojaId(e.getLojaId())
                .produtoId(e.getProdutoId())
                .quantidade(e.getQuantidade())
                .reservado(e.getReservado())
                .disponivel(e.getDisponivel())
                .criadoEm(e.getCriadoEm())
                .atualizadoEm(e.getAtualizadoEm())
                .build();
    }
}
