package com.visionbox.modules.financeiro.comissao.mapper;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoConfig;
import com.visionbox.modules.financeiro.comissao.domain.ComissaoLancamento;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoLancamentoResponse;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface ComissaoMapper {
    ComissaoConfigResponse toResponse(ComissaoConfig entity);
    void updateEntity(ComissaoConfigRequest req, @MappingTarget ComissaoConfig entity);
    ComissaoLancamentoResponse toLancamentoResponse(ComissaoLancamento entity);
}
