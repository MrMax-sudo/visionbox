package com.visionbox.modules.financeiro.maquininha.service;

import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.dto.MaquininhaCartaoRequest;
import com.visionbox.modules.financeiro.maquininha.dto.MaquininhaCartaoResponse;
import com.visionbox.modules.financeiro.maquininha.dto.MdrCalculoRequest;
import com.visionbox.modules.financeiro.maquininha.dto.ResultadoMdr;
import com.visionbox.modules.financeiro.maquininha.mapper.MaquininhaCartaoMapper;
import com.visionbox.modules.financeiro.maquininha.repository.MaquininhaCartaoRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * CRUD de maquininhas (§3.5) + acesso ao cálculo de líquido por id (compra de tenant).
 * O cálculo em si fica em {@link MdrCalculoService} (porta reutilizável, sem consulta).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MaquininhaCartaoService {

    private final MaquininhaCartaoRepository repository;
    private final MaquininhaCartaoMapper mapper;
    private final MdrCalculoService mdrCalculoService;

    @Transactional(readOnly = true)
    public List<MaquininhaCartaoResponse> listarAtivas() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findByLojaIdAndAtivoTrue(lojaId).stream().map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public MaquininhaCartaoResponse buscar(UUID id) {
        return mapper.toResponse(buscarEntidade(id));
    }

    @Transactional
    public MaquininhaCartaoResponse criar(MaquininhaCartaoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        MaquininhaCartao maq = MaquininhaCartao.builder()
                .lojaId(lojaId)
                .nome(req.getNome().trim())
                .adquirente(req.getAdquirente().trim())
                .ativo(req.getAtivo() == null || req.getAtivo())
                .debitoTaxaPercentual(req.getDebitoTaxaPercentual())
                .debitoTaxaFixa(req.getDebitoTaxaFixa())
                .credito1xTaxaPercentual(req.getCredito1xTaxaPercentual())
                .credito1xTaxaFixa(req.getCredito1xTaxaFixa())
                .credito2a6TaxaPercentual(req.getCredito2a6TaxaPercentual())
                .credito2a6TaxaFixa(req.getCredito2a6TaxaFixa())
                .credito7a12TaxaPercentual(req.getCredito7a12TaxaPercentual())
                .credito7a12TaxaFixa(req.getCredito7a12TaxaFixa())
                .build();
        MaquininhaCartao salva = repository.save(maq);
        log.info("Maquininha criada loja={} id={} adquirente={}", lojaId, salva.getId(), salva.getAdquirente());
        return mapper.toResponse(salva);
    }

    @Transactional
    public MaquininhaCartaoResponse atualizar(UUID id, MaquininhaCartaoRequest req) {
        MaquininhaCartao maq = buscarEntidade(id);
        mapper.updateEntity(req, maq);
        if (req.getAtivo() != null) maq.setAtivo(req.getAtivo());
        return mapper.toResponse(repository.save(maq));
    }

    @Transactional
    public void remover(UUID id) {
        MaquininhaCartao maq = buscarEntidade(id);
        maq.setAtivo(false);
        repository.save(maq);
        log.info("Maquininha desativada loja={} id={}", maq.getLojaId(), id);
    }

    /** Simulação/conciliação: líquido de um valor na maquininha informada (tenant sempre escopado). */
    @Transactional(readOnly = true)
    public ResultadoMdr calcularLiquido(UUID id, MdrCalculoRequest req) {
        MaquininhaCartao maq = buscarEntidade(id);
        return mdrCalculoService.calcular(req.getValor(), maq, req.getTipo(), req.getParcelas());
    }

    private MaquininhaCartao buscarEntidade(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Maquininha não encontrada"));
    }
}
