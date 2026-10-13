package com.visionbox.modules.financeiro.fornecedor.service;

import com.visionbox.modules.financeiro.fornecedor.domain.Fornecedor;
import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorRequest;
import com.visionbox.modules.financeiro.fornecedor.dto.FornecedorResponse;
import com.visionbox.modules.financeiro.fornecedor.mapper.FornecedorMapper;
import com.visionbox.modules.financeiro.fornecedor.repository.FornecedorRepository;
import com.visionbox.shared.crypto.CryptoService;
import com.visionbox.shared.tenant.TenantContext;
import com.visionbox.shared.validation.CnpjValidator;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * CRUD de Fornecedores — Fase 3 Robustez §3.3 (Contas a Pagar corporativas).
 * CNPJ cifrado AES-256-GCM + HMAC com dedup por hash por loja (R2/ADR-002) —
 * espelho do padrão do CPF em ClienteService. Resposta sempre mascarada (LGPD).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FornecedorService {

    private final FornecedorRepository repository;
    private final FornecedorMapper mapper;
    private final CryptoService cryptoService;

    @Transactional(readOnly = true)
    public Page<FornecedorResponse> listar(String nome, boolean incluirInativos, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String filtro = nome != null && !nome.isBlank() ? nome.trim() : null;
        Page<Fornecedor> page;
        if (incluirInativos) {
            // Native bypass do @SQLRestriction — inativos também aparecem (toggle do painel).
            page = repository.findAllByLojaIdInclusive(lojaId, filtro, pageable);
        } else if (filtro != null) {
            page = repository.findByLojaIdAndNomeContainingIgnoreCase(lojaId, filtro, pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        return page.map(this::toMaskedResponse);
    }

    @Transactional(readOnly = true)
    public FornecedorResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Fornecedor f = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Fornecedor não encontrado"));
        return toMaskedResponse(f);
    }

    @Transactional
    public FornecedorResponse criar(FornecedorRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        validarNome(req.getNome());
        byte[] cnpjCipher = null;
        String cnpjHash = null;
        if (req.getCnpj() != null && !req.getCnpj().isBlank()) {
            String digits = CnpjValidator.normalize(req.getCnpj());
            CnpjValidator.validateOrThrow(digits);
            cnpjHash = cryptoService.hash(digits);
            if (repository.existsByCnpjHashAndLojaId(cnpjHash, lojaId)) {
                throw new IllegalArgumentException("CNPJ já cadastrado nesta loja");
            }
            cnpjCipher = cryptoService.encrypt(digits);
        }
        Fornecedor entity = Fornecedor.builder()
                .lojaId(lojaId)
                .nome(req.getNome().trim())
                .cnpjCipher(cnpjCipher)
                .cnpjHash(cnpjHash)
                .contato(req.getContato())
                .telefone(req.getTelefone())
                .email(req.getEmail())
                .build();
        entity = repository.save(entity);
        log.info("Fornecedor criado loja={} id={} nome={}", lojaId, entity.getId(), entity.getNome());
        return toMaskedResponse(entity);
    }

    @Transactional
    public FornecedorResponse atualizar(UUID id, FornecedorRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Fornecedor f = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Fornecedor não encontrado"));
        if (req.getNome() != null && !req.getNome().isBlank()) {
            validarNome(req.getNome());
            f.setNome(req.getNome().trim());
        }
        if (req.getCnpj() != null) {
            if (req.getCnpj().isBlank()) {
                f.setCnpjCipher(null);
                f.setCnpjHash(null);
            } else {
                String digits = CnpjValidator.normalize(req.getCnpj());
                CnpjValidator.validateOrThrow(digits);
                String hash = cryptoService.hash(digits);
                // se mudar CNPJ, verifica duplicidade na loja
                if (!hash.equals(f.getCnpjHash()) && repository.existsByCnpjHashAndLojaId(hash, lojaId)) {
                    throw new IllegalArgumentException("CNPJ já cadastrado nesta loja");
                }
                f.setCnpjCipher(cryptoService.encrypt(digits));
                f.setCnpjHash(hash);
            }
        }
        if (req.getContato() != null) f.setContato(req.getContato());
        if (req.getTelefone() != null) f.setTelefone(req.getTelefone());
        if (req.getEmail() != null) f.setEmail(req.getEmail());
        repository.save(f);
        return toMaskedResponse(f);
    }

    /** Soft-delete (R7 LGPD: nada de DELETE físico em dados com rastro fiscal). */
    @Transactional
    public void remover(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Fornecedor f = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Fornecedor não encontrado"));
        f.setAtivo(false);
        repository.save(f);
        log.info("Fornecedor removido (soft) loja={} id={}", lojaId, id);
    }

    /**
     * Reativação de fornecedor (§3.3 — reversal do soft-delete). Seta {@code ativo=true}
     * via UPDATE nativo (o {@code @SQLRestriction} da entidade esconde inativos das
     * queries derivadas) SEM tocar cnpj_cipher/cnpj_hash — a cifra A1/GCM permanece
     * intacta (R2/ADR-002).
     * <p>
     * Regras:
     * <ul>
     *   <li>R1: escopo loja — id de outra loja ou inexistente → 404 (não vaza existência).</li>
     *   <li>Já ativo → resposta de sucesso idempotente (replay do mesmo POST não quebra).</li>
     *   <li>CNPJ: se o hash já existir em OUTRO fornecedor ATIVO da mesma loja → 409
     *       (DataIntegrityViolationException → ProblemDetailHandler "Conflito de dados").
     *       Nota: o índice único parcial uk_fornecedor_loja_cnpj_hash (V34) já impede duas
     *       linhas com o mesmo hash — este check é defesa em profundidade para drift manual
     *       de base. O 409 chega com detail genérico do handler compartilhado; a mensagem
     *       específica fica no log de auditoria.</li>
     * </ul>
     */
    @Transactional
    public FornecedorResponse reativar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        // Já ativo (ativo de outra loja não passa aqui): sucesso idempotente.
        Optional<Fornecedor> jaAtivo = repository.findByIdAndLojaId(id, lojaId);
        if (jaAtivo.isPresent()) {
            log.info("Fornecedor reativar idempotente loja={} id={} (já estava ativo)", lojaId, id);
            return toMaskedResponse(jaAtivo.get());
        }

        // Existe a linha (inclusive inativa)? Sem projeção de entidade — native.
        if (!repository.existsByIdAndLojaIdInclusive(id, lojaId)) {
            throw new EntityNotFoundException("Fornecedor não encontrado");
        }

        // Conflito de CNPJ: hash já presente em OUTRO fornecedor ATIVO da loja → 409.
        // existsByCnpjHashAndLojaId é derivada com @SQLRestriction → só enxerga ativos,
        // e o próprio candidato está inativo, logo não dá auto-match. Sem CNPJ → skip.
        Optional<String> cnpjHash = repository.findCnpjHashByIdAndLojaIdInclusive(id, lojaId);
        if (cnpjHash.isPresent() && repository.existsByCnpjHashAndLojaId(cnpjHash.get(), lojaId)) {
            log.warn("Reativação de fornecedor bloqueada loja={} id={} cnpj_hash={} — CNPJ ativo em outro fornecedor",
                    lojaId, id, "***");
            throw new org.springframework.dao.DataIntegrityViolationException(
                    "CNPJ já cadastrado em outro fornecedor ativo desta loja");
        }

        int atualizadas = repository.reativarByIdAndLojaId(id, lojaId);
        if (atualizadas == 0) {
            // Corrida: outra requisição reativou entre as duas leituras (então já é visível),
            // ou a linha deixou de existir — resolve pelos mesmos dois caminhos.
            if (repository.findByIdAndLojaId(id, lojaId).isEmpty()) {
                throw new EntityNotFoundException("Fornecedor não encontrado");
            }
            log.info("Fornecedor reativar concorrência benigna loja={} id={} (outra requisição reativou)", lojaId, id);
        }

        Fornecedor reativado = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Fornecedor não encontrado"));
        log.info("Fornecedor reativado loja={} id={} nome={}", lojaId, id, reativado.getNome());
        return toMaskedResponse(reativado);
    }

    private FornecedorResponse toMaskedResponse(Fornecedor f) {
        String masked = null;
        if (f.getCnpjCipher() != null) {
            try {
                String plain = cryptoService.decrypt(f.getCnpjCipher());
                masked = maskCnpj(plain);
            } catch (Exception e) {
                masked = "**.***.***/****-**";
            }
        } else if (f.getCnpjHash() != null) {
            masked = "**.***.***/****-**";
        }
        return mapper.toResponseWithMask(f, masked);
    }

    /** Revela apenas os dois primeiros dígitos (identificação + minimização LGPD). */
    static String maskCnpj(String digits) {
        if (digits == null) return null;
        String d = digits.replaceAll("\\D", "");
        if (d.length() != 14) return "**.***.***/****-**";
        return d.substring(0, 2) + ".***.***/****-**";
    }

    private static void validarNome(String nome) {
        if (nome == null || nome.trim().length() < 2) {
            throw new IllegalArgumentException("Nome deve ter ao menos 2 caracteres");
        }
    }
}
