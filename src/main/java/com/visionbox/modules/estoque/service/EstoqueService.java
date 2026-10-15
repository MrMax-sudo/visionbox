package com.visionbox.modules.estoque.service;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.estoque.domain.Estoque;
import com.visionbox.modules.estoque.dto.EstoqueResponse;
import com.visionbox.modules.estoque.mapper.EstoqueMapper;
import com.visionbox.modules.estoque.repository.EstoqueRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EstoqueService {

    private final EstoqueRepository repository;
    private final EstoqueMapper mapper;
    private final ProdutoRepository produtoRepository;

    @Transactional(readOnly = true)
    public Page<EstoqueResponse> listar(Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return repository.findAllByLojaId(lojaId, pageable).map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public EstoqueResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado"));
        return mapper.toResponse(e);
    }

    @Transactional(readOnly = true)
    public EstoqueResponse buscarPorProduto(UUID produtoId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado para produto " + produtoId));
        return mapper.toResponse(e);
    }

    @Transactional
    public EstoqueResponse criarOuAjustar(UUID produtoId, int quantidade) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (quantidade < 0) throw new IllegalArgumentException("quantidade não pode ser negativa");
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElse(Estoque.builder()
                        .lojaId(lojaId)
                        .produtoId(produtoId)
                        .quantidade(0)
                        .reservado(0)
                        .build());
        e.setQuantidade(quantidade);
        e.validarInvariantes();
        e = repository.save(e);

        if (produtoRepository != null) {
            try {
                produtoRepository.findByIdAndLojaId(produtoId, lojaId).ifPresent(p -> {
                    p.setEstoqueQuantidade(quantidade);
                    produtoRepository.save(p);
                });
            } catch (Exception ex) {
                log.warn("Erro ao sincronizar ajuste na tabela produto: {}", ex.getMessage());
            }
        }

        log.info("Estoque ajustado loja={} produto={} qtd={} reservado={}", lojaId, produtoId, e.getQuantidade(), e.getReservado());
        return mapper.toResponse(e);
    }

    @Transactional
    public EstoqueResponse adicionar(UUID produtoId, int delta) {
        if (delta <= 0) throw new IllegalArgumentException("delta deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElse(Estoque.builder().lojaId(lojaId).produtoId(produtoId).quantidade(0).reservado(0).build());
        e.setQuantidade(e.getQuantidade() + delta);
        e.validarInvariantes();
        e = repository.save(e);

        if (produtoRepository != null) {
            try {
                produtoRepository.findByIdAndLojaId(produtoId, lojaId).ifPresent(p -> {
                    int atual = p.getEstoqueQuantidade() != null ? p.getEstoqueQuantidade() : 0;
                    p.setEstoqueQuantidade(atual + delta);
                    produtoRepository.save(p);
                });
            } catch (Exception ex) {
                log.warn("Erro ao sincronizar adição na tabela produto: {}", ex.getMessage());
            }
        }

        log.info("Estoque adicionado loja={} produto={} delta={} total={}", lojaId, produtoId, delta, e.getQuantidade());
        return mapper.toResponse(e);
    }

    @Transactional
    public Estoque obterOuCriar(UUID lojaId, UUID produtoId) {
        return repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseGet(() -> {
                    int qtdInicial = 0;
                    if (produtoRepository != null) {
                        try {
                            var opt = produtoRepository.findByIdAndLojaId(produtoId, lojaId);
                            if (opt.isPresent() && opt.get().getEstoqueQuantidade() != null) {
                                qtdInicial = opt.get().getEstoqueQuantidade();
                            }
                        } catch (Exception ignored) {}
                    }
                    return repository.save(Estoque.builder()
                            .lojaId(lojaId)
                            .produtoId(produtoId)
                            .quantidade(Math.max(0, qtdInicial))
                            .reservado(0)
                            .build());
                });
    }

    /**
     * Reservar ao criar OS — incrementa reservado sem baixar físico.
     */
    @Transactional
    public EstoqueResponse reservar(UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd reservar deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = reservar(lojaId, produtoId, qtd);
        return mapper.toResponse(e);
    }

    /** Overload com lojaId explícito para uso por OS service / listeners */
    @Transactional
    public Estoque reservar(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) return null;
        Estoque e = obterOuCriar(lojaId, produtoId);
        int novoReservado = (e.getReservado() != null ? e.getReservado() : 0) + qtd;
        if (e.getQuantidade() == null || e.getQuantidade() < novoReservado) {
            e.setQuantidade(novoReservado);
        }
        e.setReservado(novoReservado);
        e.validarInvariantes();
        e = repository.save(e);

        if (produtoRepository != null) {
            try {
                produtoRepository.findByIdAndLojaId(produtoId, lojaId).ifPresent(p -> {
                    p.setEstoqueReservado((p.getEstoqueReservado() != null ? p.getEstoqueReservado() : 0) + qtd);
                    produtoRepository.save(p);
                });
            } catch (Exception ex) {
                log.warn("Erro ao reservar na tabela produto: {}", ex.getMessage());
            }
        }

        return e;
    }

    /**
     * Baixar ao ENTREGUE ou na VENDA PDV — consome estoque físico e libera reserva.
     * quantidade sai do físico; reservado decrementa se havia reserva.
     */
    @Transactional
    public EstoqueResponse baixarAoEntregue(UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd baixar deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = baixar(lojaId, produtoId, qtd);
        return mapper.toResponse(e);
    }

    @Transactional
    public Estoque baixar(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd deve ser >0");
        Estoque e = obterOuCriar(lojaId, produtoId);

        // baixa físico na tabela estoque
        int atualEstoque = e.getQuantidade() != null ? e.getQuantidade() : 0;
        e.setQuantidade(Math.max(0, atualEstoque - qtd));

        // libera reserva se houver
        int reservado = e.getReservado() != null ? e.getReservado() : 0;
        if (reservado >= qtd) {
            e.setReservado(reservado - qtd);
        } else if (reservado > 0) {
            e.setReservado(0);
            log.warn("Baixa estoque com reserva parcial loja={} produto={} reserva={} qtd={}", lojaId, produtoId, reservado, qtd);
        }
        e.validarInvariantes();
        e = repository.save(e);

        // Sincroniza baixa física na tabela produto (usada pelo catálogo e PDV)
        if (produtoRepository != null) {
            try {
                produtoRepository.findByIdAndLojaId(produtoId, lojaId).ifPresent(p -> {
                    int pQtd = p.getEstoqueQuantidade() != null ? p.getEstoqueQuantidade() : 0;
                    p.setEstoqueQuantidade(Math.max(0, pQtd - qtd));
                    int pRes = p.getEstoqueReservado() != null ? p.getEstoqueReservado() : 0;
                    if (pRes >= qtd) p.setEstoqueReservado(pRes - qtd);
                    else if (pRes > 0) p.setEstoqueReservado(0);
                    produtoRepository.save(p);
                    log.info("Baixa de estoque Produto loja={} produto={} antes={} depois={}", lojaId, produtoId, pQtd, p.getEstoqueQuantidade());
                });
            } catch (Exception ex) {
                log.warn("Erro ao sincronizar baixa na tabela produto: {}", ex.getMessage());
            }
        }
        return e;
    }

    /**
     * Estorna produto vendido — repõe estoque físico no Estoque e no Produto.
     */
    @Transactional
    public Estoque estornarVenda(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) return null;
        Estoque e = obterOuCriar(lojaId, produtoId);
        int atualEstoque = e.getQuantidade() != null ? e.getQuantidade() : 0;
        e.setQuantidade(atualEstoque + qtd);
        e.validarInvariantes();
        e = repository.save(e);

        if (produtoRepository != null) {
            try {
                produtoRepository.findByIdAndLojaId(produtoId, lojaId).ifPresent(p -> {
                    int pQtd = p.getEstoqueQuantidade() != null ? p.getEstoqueQuantidade() : 0;
                    p.setEstoqueQuantidade(pQtd + qtd);
                    produtoRepository.save(p);
                    log.info("Estorno físico de venda Produto loja={} produto={} antes={} depois={}", lojaId, produtoId, pQtd, p.getEstoqueQuantidade());
                });
            } catch (Exception ex) {
                log.warn("Erro ao sincronizar estorno de venda na tabela produto: {}", ex.getMessage());
            }
        }
        return e;
    }

    /**
     * Estornar reserva ao CANCELADO — libera reservado sem mexer no físico.
     */
    @Transactional
    public EstoqueResponse estornarAoCancelado(UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd estorno deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = estornar(lojaId, produtoId, qtd);
        return mapper.toResponse(e);
    }

    @Transactional
    public Estoque estornar(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd deve ser >0");
        Estoque e = obterOuCriar(lojaId, produtoId);
        int resAtual = e.getReservado() != null ? e.getReservado() : 0;
        e.setReservado(Math.max(0, resAtual - qtd));
        e.validarInvariantes();
        e = repository.save(e);

        if (produtoRepository != null) {
            try {
                produtoRepository.findByIdAndLojaId(produtoId, lojaId).ifPresent(p -> {
                    int pRes = p.getEstoqueReservado() != null ? p.getEstoqueReservado() : 0;
                    p.setEstoqueReservado(Math.max(0, pRes - qtd));
                    produtoRepository.save(p);
                });
            } catch (Exception ex) {
                log.warn("Erro ao liberar reserva na tabela produto: {}", ex.getMessage());
            }
        }
        return e;
    }
}
