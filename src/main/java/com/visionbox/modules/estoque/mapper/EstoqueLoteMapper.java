package com.visionbox.modules.estoque.mapper;

import com.visionbox.modules.estoque.domain.EstoqueLote;
import com.visionbox.modules.estoque.dto.EstoqueLoteResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface EstoqueLoteMapper {

    default EstoqueLoteResponse toResponse(EstoqueLote e) {
        if (e == null) return null;
        return EstoqueLoteResponse.builder()
                .id(e.getId())
                .lojaId(e.getLojaId())
                .produtoId(e.getProdutoId())
                .lote(e.getLote())
                .validade(e.getValidade())
                .quantidade(e.getQuantidade())
                .bloqueado(e.getBloqueado())
                .motivoBloqueio(e.getMotivoBloqueio())
                .vencido(e.isVencido())
                .recallCandidato(e.isRecallCandidato())
                .criadoEm(e.getCriadoEm())
                .atualizadoEm(e.getAtualizadoEm())
                .build();
    }
}
