package com.visionbox.modules.vendas.service;

import com.visionbox.modules.vendas.domain.PedidoVenda;
import com.visionbox.modules.vendas.dto.PedidoVendaRequest;
import com.visionbox.modules.vendas.dto.PedidoVendaResponse;
import com.visionbox.modules.vendas.repository.PedidoVendaRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class PedidoVendaService {

    private final PedidoVendaRepository repository;

    @Transactional
    public PedidoVendaResponse criar(PedidoVendaRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String numero = "VD-" + OffsetDateTime.now().getYear() + "-" + String.format("%05d", ThreadLocalRandom.current().nextInt(1, 99999));
        BigDecimal total = BigDecimal.ZERO;
        PedidoVenda pedido = PedidoVenda.builder()
                .lojaId(lojaId)
                .numero(numero)
                .clienteId(req.getClienteId())
                .clienteNome(req.getClienteNome())
                .observacao(req.getObservacao())
                .status("CRIADO")
                .valorTotal(BigDecimal.ZERO)
                .build();
        for (PedidoVendaRequest.ItemRequest it : req.getItens()) {
            BigDecimal preco = it.getPrecoUnitario()!=null ? new BigDecimal(it.getPrecoUnitario()) : BigDecimal.ZERO;
            preco = preco.setScale(2, RoundingMode.HALF_EVEN);
            BigDecimal subtotal = preco.multiply(BigDecimal.valueOf(it.getQuantidade())).setScale(2, RoundingMode.HALF_EVEN);
            total = total.add(subtotal);
            PedidoVenda.ItemPedido item = PedidoVenda.ItemPedido.builder()
                    .sku(it.getSku())
                    .quantidade(it.getQuantidade())
                    .precoUnitario(preco)
                    .subtotal(subtotal)
                    .pedido(pedido)
                    .build();
            pedido.addItem(item);
        }
        pedido.setValorTotal(total.setScale(2, RoundingMode.HALF_EVEN));
        pedido = repository.save(pedido);
        return toResponse(pedido);
    }

    @Transactional(readOnly = true)
    public Page<PedidoVendaResponse> listar(Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findAllByLojaId(lojaId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public PedidoVendaResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        PedidoVenda p = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Pedido não encontrado"));
        return toResponse(p);
    }

    private PedidoVendaResponse toResponse(PedidoVenda p) {
        return PedidoVendaResponse.builder()
                .id(p.getId())
                .lojaId(p.getLojaId())
                .numero(p.getNumero())
                .status(p.getStatus())
                .build();
    }
}
