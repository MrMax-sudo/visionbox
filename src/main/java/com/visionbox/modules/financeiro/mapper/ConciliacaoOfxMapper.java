package com.visionbox.modules.financeiro.mapper;

import com.visionbox.modules.financeiro.domain.ConciliacaoOfx;
import com.visionbox.modules.financeiro.dto.ConciliacaoOfxResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ConciliacaoOfxMapper {

    default ConciliacaoOfxResponse toResponse(ConciliacaoOfx e) {
        if (e == null) return null;
        return ConciliacaoOfxResponse.builder()
                .id(e.getId())
                .lojaId(e.getLojaId())
                .fitId(e.getFitId())
                .trnTipo(e.getTrnTipo())
                .dataPostamento(e.getDataPostamento())
                .valor(e.getValor())
                .memo(e.getMemo())
                .status(e.getStatus() != null ? e.getStatus().name() : null)
                .tipoConta(e.getTipoConta() != null ? e.getTipoConta().name() : null)
                .contaReceberId(e.getContaReceberId())
                .contaPagarId(e.getContaPagarId())
                .diferencaValor(e.getDiferencaValor())
                .observacao(e.getObservacao())
                .criadoEm(e.getCriadoEm())
                .build();
    }
}