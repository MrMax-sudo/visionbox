package com.visionbox.modules.ordemservico.mapper;

import com.visionbox.modules.ordemservico.domain.EventoOS;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface OrdemServicoMapper {

    @Mapping(target = "status", expression = "java(entity.getStatus()!=null?entity.getStatus().name():null)")
    @Mapping(target = "historico", expression = "java(toHistorico(entity))")
    OrdemServicoResponse toResponse(OrdemServico entity);

    default java.util.List<OrdemServicoResponse.EventoOSResponse> toHistorico(OrdemServico entity) {
        if (entity.getHistorico()==null) return java.util.List.of();
        return entity.getHistorico().stream().map(this::toEvento).toList();
    }

    default OrdemServicoResponse.EventoOSResponse toEvento(EventoOS e) {
        return OrdemServicoResponse.EventoOSResponse.builder()
                .id(e.getId())
                .statusAnterior(e.getStatusAnterior()!=null?e.getStatusAnterior().name():null)
                .statusNovo(e.getStatusNovo()!=null?e.getStatusNovo().name():null)
                .dataHora(e.getDataHora())
                .responsavel(e.getResponsavel())
                .observacao(e.getObservacao())
                .build();
    }
}
