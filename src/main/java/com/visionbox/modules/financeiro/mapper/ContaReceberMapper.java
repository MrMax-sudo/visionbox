package com.visionbox.modules.financeiro.mapper;

import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ContaReceberMapper {

    default ContaReceberResponse toResponse(ContaReceber e) {
        if (e == null) return null;
        return ContaReceberResponse.builder()
                .id(e.getId())
                .lojaId(e.getLojaId())
                .clienteId(e.getClienteId())
                .pedidoId(e.getPedidoId())
                .ordemServicoId(e.getOrdemServicoId())
                .descricao(e.getDescricao())
                .numeroDocumento(e.getNumeroDocumento())
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
