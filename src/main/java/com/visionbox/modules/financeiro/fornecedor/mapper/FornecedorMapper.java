package com.visionbox.modules.financeiro.fornecedor.mapper;

import com.visionbox.modules.financeiro.fornecedor.domain.Fornecedor;
import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface FornecedorMapper {

    @Mapping(target = "cnpjMasked", ignore = true)
    FornecedorResponse toResponse(Fornecedor entity);

    default FornecedorResponse toResponseWithMask(Fornecedor entity, String cnpjMasked) {
        FornecedorResponse r = toResponse(entity);
        r.setCnpjMasked(cnpjMasked);
        return r;
    }
}
