package com.visionbox.modules.clinico.mapper;

import com.visionbox.modules.clinico.domain.Receita;
import com.visionbox.modules.clinico.dto.GrauDto;
import com.visionbox.modules.clinico.dto.ReceitaResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.math.BigDecimal;

@Mapper(componentModel = "spring")
public interface ReceitaMapper {

    @Mapping(target = "dataEmissao", expression = "java(entity.getDataEmissao()!=null?entity.getDataEmissao().toString():null)")
    @Mapping(target = "dataValidade", expression = "java(entity.getDataValidade()!=null?entity.getDataValidade().toString():null)")
    @Mapping(target = "od", expression = "java(toOd(entity))")
    @Mapping(target = "oe", expression = "java(toOe(entity))")
    ReceitaResponse toResponse(Receita entity);

    default GrauDto toOd(Receita e) {
        if (e.getOdEsferico()==null && e.getOdCilindrico()==null && e.getOdEixo()==null && e.getOdAdicao()==null && e.getOdDnp()==null) return null;
        return GrauDto.builder()
                .esferico(e.getOdEsferico())
                .cilindrico(e.getOdCilindrico())
                .eixo(e.getOdEixo())
                .adicao(e.getOdAdicao())
                .dnp(e.getOdDnp())
                .build();
    }

    default GrauDto toOe(Receita e) {
        if (e.getOeEsferico()==null && e.getOeCilindrico()==null && e.getOeEixo()==null && e.getOeAdicao()==null && e.getOeDnp()==null) return null;
        return GrauDto.builder()
                .esferico(e.getOeEsferico())
                .cilindrico(e.getOeCilindrico())
                .eixo(e.getOeEixo())
                .adicao(e.getOeAdicao())
                .dnp(e.getOeDnp())
                .build();
    }
}
