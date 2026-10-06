package com.visionbox.modules.catalogo.mapper;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.dto.ProdutoResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProdutoMapper {

    @Mapping(target = "tipoProduto", expression = "java(entity.getTipoProduto()!=null?entity.getTipoProduto().name():null)")
    ProdutoResponse toResponse(Produto entity);
}
