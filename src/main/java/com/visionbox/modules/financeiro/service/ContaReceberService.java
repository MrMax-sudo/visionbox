package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.dto.ContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import com.visionbox.modules.financeiro.mapper.ContaReceberMapper;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContaReceberService {

    private final ContaReceberRepository repository;
    private final ContaReceberMapper mapper;

    @Transactional
    public ContaReceberResponse gerar(ContaReceberRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        BigDecimal valor = req.getValor().setScale(2, RoundingMode.HALF_EVEN);
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("valor deve ser > 0");
        }
        LocalDate venc = LocalDate.parse(req.getVencimento());
        if (venc == null) throw new IllegalArgumentException("vencimento obrigatório");

        ContaReceber entity = ContaReceber.builder()
                .lojaId(lojaId)
                .clienteId(req.getClienteId())
                .pedidoId(req.getPedidoId())
                .ordemServicoId(req.getOrdemServicoId())
                .valor(valor)
                .valorPago(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN))
                .vencimento(venc)
                .descricao(req.getDescricao())
                .numeroDocumento(req.getNumeroDocumento())
                .parcela(req.getParcela())
                .totalParcelas(req.getTotalParcelas())
                .status(ContaReceber.StatusConta.PENDENTE)
                .build();
        entity.normalizarValor();
        entity = repository.save(entity);
        log.info("ContaReceber gerada loja={} id={} cliente={} valor={} venc={}", lojaId, entity.getId(), req.getClienteId(), valor, venc);
        return mapper.toResponse(entity);
    }

    /**
     * Atalho usado ao fechar PDV/OS — cria conta com vencimento hoje + parcelamento simples.
     */
    @Transactional
    public ContaReceber gerarAoFechar(UUID clienteId, UUID pedidoId, UUID ordemServicoId, BigDecimal valorTotal, LocalDate vencimento, String descricao) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        BigDecimal valor = valorTotal.setScale(2, RoundingMode.HALF_EVEN);
        LocalDate venc = vencimento != null ? vencimento : LocalDate.now();
        ContaReceber entity = ContaReceber.builder()
                .lojaId(lojaId)
                .clienteId(clienteId)
                .pedidoId(pedidoId)
                .ordemServicoId(ordemServicoId)
                .valor(valor)
                .valorPago(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN))
                .vencimento(venc)
                .descricao(descricao != null ? descricao : "Venda PDV/OS " + (pedidoId != null ? pedidoId : ordemServicoId))
                .status(ContaReceber.StatusConta.PENDENTE)
                .build();
        entity.normalizarValor();
        entity = repository.save(entity);
        log.info("ContaReceber fechar PDV/OS loja={} cliente={} valor={} venc={}", lojaId, clienteId, valor, venc);
        return entity;
    }

    @Transactional(readOnly = true)
    public Page<ContaReceberResponse> listar(String status, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Page<ContaReceber> page;
        if (status != null && !status.isBlank()) {
            ContaReceber.StatusConta st = ContaReceber.StatusConta.valueOf(status.trim().toUpperCase());
            page = repository.findByLojaIdAndStatus(lojaId, st, pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        return page.map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public ContaReceberResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        return mapper.toResponse(e);
    }

    @Transactional
    public ContaReceberResponse baixar(UUID id, BigDecimal valorPago) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        if (e.getStatus() == ContaReceber.StatusConta.CANCELADO) {
            throw new IllegalStateException("Conta cancelada não pode ser baixada");
        }
        BigDecimal pago = valorPago != null ? valorPago.setScale(2, RoundingMode.HALF_EVEN) : e.getValor();
        BigDecimal novoPago = e.getValorPago().add(pago).setScale(2, RoundingMode.HALF_EVEN);
        if (novoPago.compareTo(e.getValor()) > 0) {
            throw new IllegalArgumentException("valor pago excede valor da conta. saldo=" + e.getSaldo());
        }
        e.setValorPago(novoPago);
        if (novoPago.compareTo(e.getValor()) == 0) {
            e.setStatus(ContaReceber.StatusConta.PAGO);
            e.setDataPagamento(OffsetDateTime.now());
        } else if (novoPago.compareTo(BigDecimal.ZERO) > 0) {
            e.setStatus(ContaReceber.StatusConta.PARCIAL);
        }
        e = repository.save(e);
        log.info("ContaReceber baixa loja={} id={} pago={} saldo={} status={}", lojaId, id, pago, e.getSaldo(), e.getStatus());
        return mapper.toResponse(e);
    }

    @Transactional
    public ContaReceberResponse cancelar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        if (e.getStatus() == ContaReceber.StatusConta.PAGO) {
            throw new IllegalStateException("Conta já paga não pode ser cancelada");
        }
        e.setStatus(ContaReceber.StatusConta.CANCELADO);
        e = repository.save(e);
        log.info("ContaReceber cancelada loja={} id={}", lojaId, id);
        return mapper.toResponse(e);
    }
}
