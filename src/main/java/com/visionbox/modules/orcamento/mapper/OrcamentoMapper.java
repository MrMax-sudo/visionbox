package com.visionbox.modules.orcamento.mapper;

import com.visionbox.modules.orcamento.domain.Orcamento;
import com.visionbox.modules.orcamento.domain.OrcamentoItem;
import com.visionbox.modules.orcamento.dto.OrcamentoItemResponse;
import com.visionbox.modules.orcamento.dto.OrcamentoResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface OrcamentoMapper {

    OrcamentoResponse toResponse(Orcamento entity);

    OrcamentoItemResponse toItemResponse(OrcamentoItem entity);
}
