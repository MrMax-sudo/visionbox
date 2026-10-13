package com.visionbox.modules.catalogo.service;

import com.visionbox.modules.catalogo.domain.Categoria;
import com.visionbox.modules.catalogo.dto.CategoriaRequest;
import com.visionbox.modules.catalogo.dto.CategoriaResponse;
import com.visionbox.modules.catalogo.mapper.CategoriaMapper;
import com.visionbox.modules.catalogo.repository.CategoriaRepository;
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
public class CategoriaService {

    private final CategoriaRepository repository;
    private final CategoriaMapper mapper;

    @Transactional(readOnly = true)
    public Page<CategoriaResponse> listar(String termo, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String filtro = (termo == null || termo.isBlank()) ? null : termo.trim();
        Page<Categoria> page = repository.buscarFiltrado(lojaId, filtro, pageable);
        return page.map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listarTodas() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findAllByLojaIdOrderByNomeAsc(lojaId)
                .stream()
                .map(mapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoriaResponse buscarPorId(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Categoria c = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Categoria não encontrada com ID: " + id));
        return mapper.toResponse(c);
    }

    @Transactional
    public CategoriaResponse criar(CategoriaRequest request) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        String nome = request.getNome().trim();

        if (repository.existsByLojaIdAndNomeIgnoreCase(lojaId, nome)) {
            throw new IllegalArgumentException("Já existe uma categoria cadastrada com o nome: " + nome);
        }

        Categoria c = Categoria.builder()
                .lojaId(lojaId)
                .nome(nome)
                .descricao(request.getDescricao() != null ? request.getDescricao().trim() : null)
                .build();

        c = repository.save(c);
        return mapper.toResponse(c);
    }

    @Transactional
    public CategoriaResponse atualizar(UUID id, CategoriaRequest request) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Categoria c = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Categoria não encontrada com ID: " + id));

        String novoNome = request.getNome().trim();
        if (repository.existsByLojaIdAndNomeIgnoreCaseAndIdNot(lojaId, novoNome, id)) {
            throw new IllegalArgumentException("Já existe outra categoria com o nome: " + novoNome);
        }

        c.setNome(novoNome);
        c.setDescricao(request.getDescricao() != null ? request.getDescricao().trim() : null);

        c = repository.save(c);
        return mapper.toResponse(c);
    }

    @Transactional
    public void excluir(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Categoria c = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Categoria não encontrada com ID: " + id));

        c.setAtivo(false);
        repository.save(c);
    }

    /**
     * Utilitário para localizar categoria por nome ou criar se inexistente.
     * Usado em cargas, importações e seeds.
     */
    @Transactional
    public Categoria obterOuCriar(UUID lojaId, String nome, String descricao) {
        String nomeLimpo = nome.trim();
        return repository.findByLojaIdAndNomeIgnoreCase(lojaId, nomeLimpo)
                .orElseGet(() -> repository.save(Categoria.builder()
                        .lojaId(lojaId)
                        .nome(nomeLimpo)
                        .descricao(descricao)
                        .build()));
    }
}
