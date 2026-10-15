package com.visionbox.modules.orcamento.service;

import com.visionbox.modules.orcamento.domain.Orcamento;
import com.visionbox.modules.orcamento.domain.OrcamentoItem;
import com.visionbox.modules.orcamento.domain.OrcamentoStatus;
import com.visionbox.modules.orcamento.dto.OrcamentoItemRequest;
import com.visionbox.modules.orcamento.dto.OrcamentoRequest;
import com.visionbox.modules.orcamento.dto.OrcamentoResponse;
import com.visionbox.modules.orcamento.mapper.OrcamentoMapper;
import com.visionbox.modules.orcamento.repository.OrcamentoRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrcamentoService {

    private final OrcamentoRepository repository;
    private final OrcamentoMapper mapper;

    @Transactional(readOnly = true)
    public Page<OrcamentoResponse> listar(OrcamentoStatus status, String termo, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String filtroTermo = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        return repository.listarComFiltros(lojaId, status, filtroTermo, pageable)
                .map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public OrcamentoResponse buscarPorId(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Orcamento orcamento = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Orçamento não encontrado"));
        return mapper.toResponse(orcamento);
    }

    @Transactional
    public OrcamentoResponse criar(OrcamentoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        long seq = repository.countByLojaId(lojaId) + 1;
        String ano = String.valueOf(LocalDate.now().getYear());
        String numero = String.format("ORC-%s-%05d", ano, seq);

        // Garante unicidade caso já exista o número
        while (repository.findByNumeroAndLojaId(numero, lojaId).isPresent()) {
            seq++;
            numero = String.format("ORC-%s-%05d", ano, seq);
        }

        BigDecimal subtotalGeral = BigDecimal.ZERO;
        BigDecimal descontoGeral = req.getDesconto() != null ? req.getDesconto() : BigDecimal.ZERO;

        Orcamento orcamento = Orcamento.builder()
                .lojaId(lojaId)
                .numero(numero)
                .clienteId(req.getClienteId())
                .clienteNome(req.getClienteNome() != null ? req.getClienteNome().trim() : "Consumidor Final")
                .clienteCpf(req.getClienteCpf())
                .clienteTelefone(req.getClienteTelefone())
                .vendedorId(req.getVendedorId())
                .vendedorNome(req.getVendedorNome())
                .validadeDias(req.getValidadeDias() != null ? req.getValidadeDias() : 15)
                .status(OrcamentoStatus.ABERTO)
                .observacoes(req.getObservacoes())
                .condicoesPagamento(req.getCondicoesPagamento())
                .build();

        if (req.getItens() != null && !req.getItens().isEmpty()) {
            for (OrcamentoItemRequest itemReq : req.getItens()) {
                BigDecimal qtd = itemReq.getQuantidade() != null ? itemReq.getQuantidade() : BigDecimal.ONE;
                BigDecimal unit = itemReq.getPrecoUnitario() != null ? itemReq.getPrecoUnitario() : BigDecimal.ZERO;
                BigDecimal desc = itemReq.getDesconto() != null ? itemReq.getDesconto() : BigDecimal.ZERO;
                BigDecimal sub = (itemReq.getSubtotal() != null && itemReq.getSubtotal().compareTo(BigDecimal.ZERO) > 0)
                        ? itemReq.getSubtotal()
                        : qtd.multiply(unit).subtract(desc);

                subtotalGeral = subtotalGeral.add(sub);

                OrcamentoItem item = OrcamentoItem.builder()
                        .lojaId(lojaId)
                        .produtoId(itemReq.getProdutoId())
                        .sku(itemReq.getSku())
                        .descricao(itemReq.getDescricao())
                        .quantidade(qtd)
                        .precoUnitario(unit)
                        .desconto(desc)
                        .subtotal(sub)
                        .build();

                orcamento.addItem(item);
            }
        }

        orcamento.setValorSubtotal(subtotalGeral);
        orcamento.setDesconto(descontoGeral);
        BigDecimal total = subtotalGeral.subtract(descontoGeral);
        orcamento.setValorTotal(total.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : total);

        orcamento = repository.save(orcamento);
        log.info("Orçamento criado com sucesso loja={} numero={} total={}", lojaId, numero, orcamento.getValorTotal());
        return mapper.toResponse(orcamento);
    }

    @Transactional
    public OrcamentoResponse atualizarStatus(UUID id, OrcamentoStatus novoStatus) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Orcamento orcamento = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Orçamento não encontrado"));
        orcamento.setStatus(novoStatus);
        orcamento.setAtualizadoEm(OffsetDateTime.now());
        repository.save(orcamento);
        return mapper.toResponse(orcamento);
    }

    @Transactional
    public OrcamentoResponse converterEmVenda(UUID id, UUID vendaId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Orcamento orcamento = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Orçamento não encontrado"));
        orcamento.setStatus(OrcamentoStatus.CONVERTIDO);
        orcamento.setVendaId(vendaId);
        orcamento.setAtualizadoEm(OffsetDateTime.now());
        repository.save(orcamento);
        return mapper.toResponse(orcamento);
    }

    @Transactional
    public OrcamentoResponse atualizar(UUID id, OrcamentoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Orcamento orcamento = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Orçamento não encontrado"));

        if (orcamento.getStatus() == OrcamentoStatus.CONVERTIDO) {
            throw new IllegalStateException("Não é possível alterar um orçamento que já foi convertido em venda.");
        }

        orcamento.setClienteId(req.getClienteId());
        if (req.getClienteNome() != null && !req.getClienteNome().isBlank()) {
            orcamento.setClienteNome(req.getClienteNome().trim());
        }
        orcamento.setClienteCpf(req.getClienteCpf());
        orcamento.setClienteTelefone(req.getClienteTelefone());
        orcamento.setVendedorId(req.getVendedorId());
        orcamento.setVendedorNome(req.getVendedorNome());
        if (req.getValidadeDias() != null) {
            orcamento.setValidadeDias(req.getValidadeDias());
        }
        orcamento.setObservacoes(req.getObservacoes());
        orcamento.setCondicoesPagamento(req.getCondicoesPagamento());

        BigDecimal subtotalGeral = BigDecimal.ZERO;
        BigDecimal descontoGeral = req.getDesconto() != null ? req.getDesconto() : BigDecimal.ZERO;

        orcamento.getItens().clear();
        if (req.getItens() != null && !req.getItens().isEmpty()) {
            for (OrcamentoItemRequest itemReq : req.getItens()) {
                BigDecimal qtd = itemReq.getQuantidade() != null ? itemReq.getQuantidade() : BigDecimal.ONE;
                BigDecimal unit = itemReq.getPrecoUnitario() != null ? itemReq.getPrecoUnitario() : BigDecimal.ZERO;
                BigDecimal desc = itemReq.getDesconto() != null ? itemReq.getDesconto() : BigDecimal.ZERO;
                BigDecimal sub = (itemReq.getSubtotal() != null && itemReq.getSubtotal().compareTo(BigDecimal.ZERO) > 0)
                        ? itemReq.getSubtotal()
                        : qtd.multiply(unit).subtract(desc);

                subtotalGeral = subtotalGeral.add(sub);

                OrcamentoItem item = OrcamentoItem.builder()
                        .lojaId(lojaId)
                        .produtoId(itemReq.getProdutoId())
                        .sku(itemReq.getSku())
                        .descricao(itemReq.getDescricao())
                        .quantidade(qtd)
                        .precoUnitario(unit)
                        .desconto(desc)
                        .subtotal(sub)
                        .build();

                orcamento.addItem(item);
            }
        }

        orcamento.setValorSubtotal(subtotalGeral);
        orcamento.setDesconto(descontoGeral);
        BigDecimal total = subtotalGeral.subtract(descontoGeral);
        orcamento.setValorTotal(total.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : total);
        orcamento.setAtualizadoEm(OffsetDateTime.now());

        orcamento = repository.save(orcamento);
        log.info("Orçamento atualizado loja={} id={} total={}", lojaId, id, orcamento.getValorTotal());
        return mapper.toResponse(orcamento);
    }

    @Transactional
    public void excluir(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Orcamento orcamento = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Orçamento não encontrado"));

        if (orcamento.getStatus() == OrcamentoStatus.CONVERTIDO) {
            throw new IllegalStateException("Não é possível excluir um orçamento já convertido em venda.");
        }

        repository.delete(orcamento);
        log.info("Orçamento excluído loja={} id={}", lojaId, id);
    }
}
