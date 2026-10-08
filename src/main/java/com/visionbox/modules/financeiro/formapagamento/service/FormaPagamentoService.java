package com.visionbox.modules.financeiro.formapagamento.service;

import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoRequest;
import com.visionbox.modules.financeiro.formapagamento.dto.FormaPagamentoResponse;
import com.visionbox.modules.financeiro.formapagamento.mapper.FormaPagamentoMapper;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FormaPagamentoService {

    private final FormaPagamentoRepository repository;
    private final FormaPagamentoMapper mapper;

    @Transactional(readOnly = true)
    public List<FormaPagamentoResponse> listarAtivas() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findByLojaIdAndAtivoTrue(lojaId).stream()
                .map(mapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public FormaPagamentoResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        FormaPagamento fp = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Forma de pagamento não encontrada"));
        return mapper.toResponse(fp);
    }

    @Transactional
    public FormaPagamentoResponse criar(FormaPagamentoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        
        if (req.getPadrao() != null && req.getPadrao()) {
            repository.findByLojaIdAndPadraoTrue(lojaId).ifPresent(p -> {
                p.setPadrao(false);
                repository.save(p);
            });
        }

        FormaPagamento fp = FormaPagamento.builder()
                .lojaId(lojaId)
                .nome(req.getNome())
                .tipo(req.getTipo())
                .ativo(req.getAtivo() != null ? req.getAtivo() : true)
                .padrao(req.getPadrao() != null ? req.getPadrao() : false)
                .taxaPercentual(req.getTaxaPercentual())
                .prazoDias(req.getPrazoDias())
                .permiteParcelar(req.getPermiteParcelar() != null ? req.getPermiteParcelar() : false)
                .maxParcelas(req.getMaxParcelas())
                .tPagNfce(req.getTPagNfce())
                .build();

        return mapper.toResponse(repository.save(fp));
    }

    @Transactional
    public FormaPagamentoResponse atualizar(UUID id, FormaPagamentoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        FormaPagamento fp = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Forma de pagamento não encontrada"));

        if (req.getPadrao() != null && req.getPadrao()) {
            repository.findByLojaIdAndPadraoTrue(lojaId).ifPresent(p -> {
                if (!p.getId().equals(id)) {
                    p.setPadrao(false);
                    repository.save(p);
                }
            });
        }

        mapper.updateEntity(req, fp);
        return mapper.toResponse(repository.save(fp));
    }

    @Transactional
    public void remover(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        FormaPagamento fp = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Forma de pagamento não encontrada"));
        fp.setAtivo(false);
        repository.save(fp);
    }
}
