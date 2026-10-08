package com.visionbox.modules.producao.service;

import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.ordemservico.service.OrdemServicoService;
import com.visionbox.modules.producao.domain.ProducaoOS;
import com.visionbox.modules.producao.dto.ProducaoCQRequest;
import com.visionbox.modules.producao.dto.ProducaoResponse;
import com.visionbox.modules.producao.repository.ProducaoOSRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProducaoService {

    private static final Set<StatusOS> FILA_PRODUCAO = Set.of(StatusOS.EM_PRODUCAO, StatusOS.MONTAGEM);
    private static final String RESPONSAVEL = "producao";

    private final ProducaoOSRepository producaoRepository;
    private final OrdemServicoRepository osRepository;
    private final OrdemServicoService osService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<ProducaoResponse> listarFila(Pageable pageable, UUID laboratorioId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (laboratorioId != null) {
            return osRepository.findByLojaIdAndStatusInAndLaboratorioId(lojaId, FILA_PRODUCAO, laboratorioId, pageable)
                    .map(this::toResponse);
        }
        return osRepository.findByLojaIdAndStatusIn(lojaId, FILA_PRODUCAO, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ProducaoResponse> listarFila(Pageable pageable) {
        return listarFila(pageable, null);
    }

    @Transactional
    public ProducaoResponse iniciar(UUID osId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = buscarOs(osId, lojaId);
        ProducaoOS producao = buscarOuCriar(osId, lojaId);
        if (producao.getInicioProducao() == null) {
            producao.setInicioProducao(OffsetDateTime.now(clock));
        }
        ProducaoOS salva = producaoRepository.save(producao);
        return toResponse(salva, os);
    }

    @Transactional
    public ProducaoResponse finalizar(UUID osId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = buscarOs(osId, lojaId);
        ProducaoOS producao = buscarOuCriar(osId, lojaId);
        if (producao.getInicioProducao() == null) {
            producao.setInicioProducao(OffsetDateTime.now(clock));
        }
        producao.setFimProducao(OffsetDateTime.now(clock));
        ProducaoOS salva = producaoRepository.save(producao);

        StatusOS destino = os.getStatus() == StatusOS.MONTAGEM
                ? StatusOS.CONTROLE_QUALIDADE
                : StatusOS.LENTE_PRONTA;
        OrdemServico atualizada = osService.avancar(lojaId, osId, destino, RESPONSAVEL, "Produção finalizada");
        return toResponse(salva, atualizada);
    }

    @Transactional
    public ProducaoResponse registrarCQ(UUID osId, ProducaoCQRequest request) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        buscarOs(osId, lojaId);
        ProducaoOS producao = buscarOuCriar(osId, lojaId);

        boolean aprovado = Boolean.TRUE.equals(request.getAprovado());
        if (!aprovado && isBlank(request.getFotoS3Key()) && isBlank(request.getFotoUrl())) {
            throw new BusinessException("Controle de qualidade reprovado exige foto");
        }

        producao.setCqAprovado(aprovado);
        producao.setCqReprovadoMotivo(aprovado ? null : request.getMotivoReprovacao());
        producao.setFotoS3Key(request.getFotoS3Key());
        producao.setFotoS3Bucket(request.getFotoS3Bucket());
        producao.setFotoUrl(request.getFotoUrl());
        producao.setObservacao(request.getObservacao());
        ProducaoOS salva = producaoRepository.save(producao);

        StatusOS destino = aprovado ? StatusOS.PRONTO_PARA_RETIRADA : StatusOS.RETRABALHO;
        OrdemServico atualizada = osService.avancar(lojaId, osId, destino, RESPONSAVEL,
                aprovado ? "Controle de qualidade aprovado" : "Controle de qualidade reprovado");
        return toResponse(salva, atualizada);
    }

    private OrdemServico buscarOs(UUID osId, UUID lojaId) {
        return osRepository.findByIdAndLojaId(osId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Ordem de serviço não encontrada"));
    }

    private ProducaoOS buscarOuCriar(UUID osId, UUID lojaId) {
        return producaoRepository.findByOrdemServicoIdAndLojaId(osId, lojaId)
                .orElseGet(() -> ProducaoOS.builder()
                        .lojaId(lojaId)
                        .ordemServicoId(osId)
                        .build());
    }

    private ProducaoResponse toResponse(OrdemServico os) {
        return ProducaoResponse.builder()
                .ordemServicoId(os.getId())
                .lojaId(os.getLojaId())
                .statusOs(os.getStatus() != null ? os.getStatus().name() : null)
                .build();
    }

    private ProducaoResponse toResponse(ProducaoOS producao, OrdemServico os) {
        return ProducaoResponse.builder()
                .id(producao.getId())
                .lojaId(producao.getLojaId())
                .ordemServicoId(producao.getOrdemServicoId())
                .statusOs(os != null && os.getStatus() != null ? os.getStatus().name() : null)
                .inicioProducao(producao.getInicioProducao())
                .fimProducao(producao.getFimProducao())
                .cqAprovado(producao.getCqAprovado())
                .cqReprovadoMotivo(producao.getCqReprovadoMotivo())
                .fotoS3Key(producao.getFotoS3Key())
                .fotoS3Bucket(producao.getFotoS3Bucket())
                .fotoUrl(producao.getFotoUrl())
                .responsavelNome(producao.getResponsavelNome())
                .observacao(producao.getObservacao())
                .build();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}