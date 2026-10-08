package com.visionbox.modules.financeiro.mapper;

import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.dto.ContaPagarResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ContaPagarMapper {

    default ContaPagarResponse toResponse(ContaPagar e) {
        if (e == null) return null;
        return ContaPagarResponse.builder()
                .id(e.getId())
                .lojaId(e.getLojaId())
                .fornecedor(e.getFornecedor())
                .descricao(e.getDescricao())
                .numeroDocumento(e.getNumeroDocumento())
                .ordemServicoId(e.getOrdemServicoId())
                .valor(e.getValor())
                .valorPago(e.getValorPago())
                .saldo(e.getSaldo())
                .vencimento(e.getVencimento())
                .dataPagamento(e.getDataPagamento())
                .status(e.getStatus() != null ? e.getStatus().name() : null)
                .parcela(e.getParcela())
                .totalParcelas(e.getTotalParcelas())
                .criadoEm(e.getCriadoEm())
                .vencida(e.isVencida())
                .build();
    }
}
