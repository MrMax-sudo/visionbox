package com.visionbox.modules.crm.service;

import com.visionbox.modules.clinico.domain.Receita;
import com.visionbox.modules.clinico.repository.ReceitaRepository;
import com.visionbox.modules.crm.dto.RecallResponse;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * RecallService — diferencial CRM VisionBox.
 * <p>
 * Busca receitas com {@code dataValidade BETWEEN now() AND now()+dias}
 * e {@code cliente.consentimento_recall=true} (LGPD).
 * <p>
 * Isolamento multi-tenant obrigatório via lojaId.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecallService {

    private final ReceitaRepository receitaRepository;
    private final ClienteRepository clienteRepository;
    private final Clock clock;

    /**
     * Método exigido na tarefa: {@code buscarReceitasVencidas(lojaId, dias=30)}
     * Query: {@code receita.dataValidade BETWEEN now() AND now()+dias} com {@code consentimento_recall=true}.
     *
     * @param lojaId tenant obrigatório
     * @param dias   janela de dias a partir de hoje (default 30). Deve ser &gt;=0.
     * @param pageable paginação Spring Data
     * @return página de RecallResponse
     */
    @Transactional(readOnly = true)
    public Page<RecallResponse> buscarReceitasVencidas(UUID lojaId, int dias, Pageable pageable) {
        if (lojaId == null) {
            throw new IllegalArgumentException("lojaId é obrigatório para recall (multi-tenant)");
        }
        if (dias < 0) {
            throw new IllegalArgumentException("dias deve ser >= 0");
        }
        if (dias > 365) {
            log.warn("janela recall muito grande loja={} dias={} — limitar pode ser necessário", lojaId, dias);
        }
        LocalDate hoje = LocalDate.now(clock);
        LocalDate limite = hoje.plusDays(dias);

        Page<Receita> page = receitaRepository.findReceitasVencidasComConsentimento(lojaId, hoje, limite, pageable);
        log.debug("Recall buscarReceitasVencidas loja={} dias={} hoje={} limite={} encontrados={}", lojaId, dias, hoje, limite, page.getTotalElements());
        return page.map(r -> toRecallResponse(r, lojaId));
    }

    /**
     * Overload com dias padrão = 30 (exigido: dias=30).
     */
    @Transactional(readOnly = true)
    public Page<RecallResponse> buscarReceitasVencidas(UUID lojaId, Pageable pageable) {
        return buscarReceitasVencidas(lojaId, 30, pageable);
    }

    /**
     * Overload não paginado para uso interno/batch.
     */
    @Transactional(readOnly = true)
    public List<RecallResponse> buscarReceitasVencidas(UUID lojaId, int dias) {
        if (lojaId == null) {
            throw new IllegalArgumentException("lojaId é obrigatório");
        }
        LocalDate hoje = LocalDate.now(clock);
        LocalDate limite = hoje.plusDays(dias);
        List<Receita> list = receitaRepository.findReceitasVencidasComConsentimentoList(lojaId, hoje, limite);
        return list.stream().map(r -> toRecallResponse(r, lojaId)).toList();
    }

    private RecallResponse toRecallResponse(Receita r, UUID lojaId) {
        // Busca cliente para enriquecer (nome, contato). Se cliente não existir por inconsistência, retorna dados parciais.
        Cliente cliente = null;
        try {
            cliente = clienteRepository.findByIdAndLojaId(r.getClienteId(), lojaId).orElse(null);
        } catch (Exception e) {
            log.warn("Recall: falha ao buscar cliente {} loja={} erro={}", r.getClienteId(), lojaId, e.getMessage());
        }
        return RecallResponse.builder()
                .receitaId(r.getId())
                .clienteId(r.getClienteId())
                .clienteNome(cliente != null ? cliente.getNome() : null)
                .telefone(cliente != null ? cliente.getTelefone() : null)
                .whatsapp(cliente != null ? cliente.getWhatsapp() : null)
                .email(cliente != null ? cliente.getEmail() : null)
                .canalPreferido(cliente != null ? cliente.getCanalPreferido() : null)
                .dataValidade(r.getDataValidade())
                .dataEmissao(r.getDataEmissao())
                .nomeMedico(r.getNomeMedico())
                .observacao(r.getObservacao())
                .lojaId(r.getLojaId())
                .criadoEm(r.getCriadoEm())
                .build();
    }
}
