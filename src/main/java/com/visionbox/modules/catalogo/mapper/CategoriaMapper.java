package com.visionbox.modules.catalogo.mapper;

import com.visionbox.modules.catalogo.domain.Categoria;
import com.visionbox.modules.catalogo.dto.CategoriaResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CategoriaMapper {

    CategoriaResponse toResponse(Categoria entity);
}
