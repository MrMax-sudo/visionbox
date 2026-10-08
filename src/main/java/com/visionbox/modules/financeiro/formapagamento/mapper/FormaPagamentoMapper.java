package com.visionbox.modules.financeiro.formapagamento.mapper;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoRequest;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoResponse;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface FormaPagamentoMapper {
    FormaPagamentoResponse toResponse(FormaPagamento entity);
    void updateEntity(FormaPagamentoRequest req, @MappingTarget FormaPagamento entity);
}
