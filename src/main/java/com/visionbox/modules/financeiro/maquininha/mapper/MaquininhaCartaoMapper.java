package com.visionbox.modules.financeiro.maquininha.mapper;

import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.dto.MaquininhaCartaoRequest;
import com.visionbox.modules.financeiro.maquininha.dto.MaquininhaCartaoResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface MaquininhaCartaoMapper {
    MaquininhaCartaoResponse toResponse(MaquininhaCartao entity);

    /** ativo fora do mapper (semântica de soft-delete) — service decide. */
    @Mapping(target = "ativo", ignore = true)
    void updateEntity(MaquininhaCartaoRequest req, @MappingTarget MaquininhaCartao entity);
}
