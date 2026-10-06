package com.visionbox.modules.estoque.service;

import com.visionbox.modules.estoque.domain.EstoqueLote;
import com.visionbox.modules.estoque.dto.EstoqueLoteRequest;
import com.visionbox.modules.estoque.dto.EstoqueLoteResponse;
import com.visionbox.modules.estoque.mapper.EstoqueLoteMapper;
import com.visionbox.modules.estoque.repository.EstoqueLoteRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EstoqueLoteService {

    private final EstoqueLoteRepository repository;
    private final EstoqueLoteMapper mapper;

    @Transactional
    public EstoqueLoteResponse criar(EstoqueLoteRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (req.getProdutoId() == null) throw new IllegalArgumentException("produtoId obrigatório");
        if (req.getLote() == null || req.getLote().isBlank()) throw new IllegalArgumentException("lote obrigatório");
        if (req.getQuantidade() == null || req.getQuantidade() < 0) throw new IllegalArgumentException("quantidade deve ser >=0");

        String loteNorm = req.getLote().trim().toUpperCase();
        if (repository.existsByLojaIdAndProdutoIdAndLote(lojaId, req.getProdutoId(), loteNorm)) {
            throw new IllegalStateException("Lote já existe para este produto nesta loja: " + loteNorm);
        }

        LocalDate validade = null;
        if (req.getValidade() != null && !req.getValidade().isBlank()) {
            validade = LocalDate.parse(req.getValidade().trim());
        }

        EstoqueLote entity = EstoqueLote.builder()
                .lojaId(lojaId)
                .produtoId(req.getProdutoId())
                .lote(loteNorm)
                .validade(validade)
                .quantidade(req.getQuantidade())
                .bloqueado(false)
                .build();
        entity.validarInvariantes();
        entity = repository.save(entity);
        log.info("EstoqueLote criado loja={} produto={} lote={} validade={} qtd={}", lojaId, req.getProdutoId(), loteNorm, validade, req.getQuantidade());
        return mapper.toResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<EstoqueLoteResponse> listar(Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findAllByLojaId(lojaId, pageable).map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public EstoqueLoteResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        EstoqueLote e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("EstoqueLote não encontrado"));
        return mapper.toResponse(e);
    }

    @Transactional
    public EstoqueLoteResponse bloquear(UUID id, String motivo) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        EstoqueLote e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("EstoqueLote não encontrado"));
        e.setBloqueado(true);
        e.setMotivoBloqueio(motivo != null ? motivo : "Recall — bloqueio preventivo");
        e = repository.save(e);
        log.warn("EstoqueLote BLOQUEADO recall loja={} produto={} lote={} motivo={}", lojaId, e.getProdutoId(), e.getLote(), motivo);
        return mapper.toResponse(e);
    }

    @Transactional
    public EstoqueLoteResponse ajustarQuantidade(UUID id, int quantidade) {
        if (quantidade < 0) throw new IllegalArgumentException("quantidade não pode ser negativa");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        EstoqueLote e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("EstoqueLote não encontrado"));
        e.setQuantidade(quantidade);
        e.validarInvariantes();
        e = repository.save(e);
        log.info("EstoqueLote qtd ajustada loja={} lote={} qtd={}", lojaId, e.getLote(), quantidade);
        return mapper.toResponse(e);
    }
}
