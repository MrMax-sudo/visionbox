package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.financeiro.domain.ContaPagar;
import com.visionbox.modules.financeiro.dto.ContaPagarRequest;
import com.visionbox.modules.financeiro.dto.ContaPagarResponse;
import com.visionbox.modules.financeiro.fornecedor.domain.Fornecedor;
import com.visionbox.modules.financeiro.fornecedor.repository.FornecedorRepository;
import com.visionbox.modules.financeiro.mapper.ContaPagarMapper;
import com.visionbox.modules.financeiro.repository.ContaPagarRepository;
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
public class ContaPagarService {

    private final ContaPagarRepository repository;
    private final ContaPagarMapper mapper;
    private final FornecedorRepository fornecedorRepository;

    @Transactional
    public ContaPagarResponse criar(ContaPagarRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        // V34 — aceita fornecedorId (cadastro) ou texto livre; nome denormalizado p/ DRE/compat
        String fornecedorNome = req.getFornecedor() != null ? req.getFornecedor().trim() : null;
        if (req.getFornecedorId() != null) {
            Fornecedor forn = fornecedorRepository.findByIdAndLojaId(req.getFornecedorId(), lojaId)
                    .orElseThrow(() -> new EntityNotFoundException("Fornecedor não encontrado"));
            fornecedorNome = forn.getNome();
        }
        if (fornecedorNome == null || fornecedorNome.isBlank()) {
            throw new IllegalArgumentException("fornecedor ou fornecedorId é obrigatório");
        }
        BigDecimal valor = req.getValor().setScale(2, RoundingMode.HALF_EVEN);
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("valor deve ser > 0");
        }
        LocalDate venc = LocalDate.parse(req.getVencimento());
        if (venc == null) throw new IllegalArgumentException("vencimento obrigatório");
        // V34 — competência opcional; default = vencimento (regime p/ DRE)
        LocalDate competencia = req.getDataCompetencia() != null && !req.getDataCompetencia().isBlank()
                ? LocalDate.parse(req.getDataCompetencia())
                : venc;

        ContaPagar entity = ContaPagar.builder()
                .lojaId(lojaId)
                .fornecedor(fornecedorNome)
                .fornecedorId(req.getFornecedorId())
                .dataCompetencia(competencia)
                .comprovanteUrl(req.getComprovanteUrl())
                .descricao(req.getDescricao())
                .numeroDocumento(req.getNumeroDocumento())
                .ordemServicoId(req.getOrdemServicoId())
                .valor(valor)
                .valorPago(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN))
                .vencimento(venc)
                .parcela(req.getParcela())
                .totalParcelas(req.getTotalParcelas())
                .status(ContaPagar.StatusContaPagar.PENDENTE)
                .build();
        entity.normalizarValor();
        entity = repository.save(entity);
        log.info("ContaPagar criada loja={} id={} fornecedor={} valor={} venc={} compet={}", lojaId, entity.getId(), fornecedorNome, valor, venc, competencia);
        return mapper.toResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<ContaPagarResponse> listar(String status, String fornecedor, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Page<ContaPagar> page;
        if (status != null && !status.isBlank()) {
            ContaPagar.StatusContaPagar st = ContaPagar.StatusContaPagar.valueOf(status.trim().toUpperCase());
            page = repository.findByLojaIdAndStatus(lojaId, st, pageable);
        } else if (fornecedor != null && !fornecedor.isBlank()) {
            page = repository.findByLojaIdAndFornecedorContainingIgnoreCase(lojaId, fornecedor.trim(), pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        return page.map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public ContaPagarResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaPagar e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a pagar não encontrada"));
        return mapper.toResponse(e);
    }

    @Transactional
    public ContaPagarResponse baixar(UUID id, BigDecimal valorPago) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaPagar e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a pagar não encontrada"));
        if (e.getStatus() == ContaPagar.StatusContaPagar.CANCELADO) {
            throw new IllegalStateException("Conta cancelada não pode ser baixada");
        }
        BigDecimal pago = valorPago != null ? valorPago.setScale(2, RoundingMode.HALF_EVEN) : e.getValor();
        BigDecimal novoPago = e.getValorPago().add(pago).setScale(2, RoundingMode.HALF_EVEN);
        if (novoPago.compareTo(e.getValor()) > 0) {
            throw new IllegalArgumentException("valor pago excede valor da conta. saldo=" + e.getSaldo());
        }
        e.setValorPago(novoPago);
        if (novoPago.compareTo(e.getValor()) == 0) {
            e.setStatus(ContaPagar.StatusContaPagar.PAGO);
            e.setDataPagamento(OffsetDateTime.now());
        } else if (novoPago.compareTo(BigDecimal.ZERO) > 0) {
            e.setStatus(ContaPagar.StatusContaPagar.PARCIAL);
        }
        e = repository.save(e);
        log.info("ContaPagar baixa loja={} id={} pago={} saldo={} status={}", lojaId, id, pago, e.getSaldo(), e.getStatus());
        return mapper.toResponse(e);
    }

    @Transactional
    public ContaPagarResponse cancelar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaPagar e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a pagar não encontrada"));
        if (e.getStatus() == ContaPagar.StatusContaPagar.PAGO) {
            throw new IllegalStateException("Conta já paga não pode ser cancelada");
        }
        e.setStatus(ContaPagar.StatusContaPagar.CANCELADO);
        e = repository.save(e);
        log.info("ContaPagar cancelada loja={} id={}", lojaId, id);
        return mapper.toResponse(e);
    }
}
