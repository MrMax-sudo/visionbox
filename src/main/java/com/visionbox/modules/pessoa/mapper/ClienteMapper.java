package com.visionbox.modules.pessoa.mapper;

import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.dto.ClienteResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ClienteMapper {

    @Mapping(target = "cpfMasked", ignore = true)
    ClienteResponse toResponse(Cliente entity);

    default ClienteResponse toResponseWithMask(Cliente entity, String cpfMasked) {
        ClienteResponse r = toResponse(entity);
        r.setCpfMasked(cpfMasked);
        if (entity.getDataNascimento() != null) {
            r.setDataNascimento(entity.getDataNascimento().toString());
        }
        return r;
    }
}
