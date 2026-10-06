package com.visionbox.modules.estoque.service;

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
        log.info("Estoque adicionado loja={} produto={} delta={} total={}", lojaId, produtoId, delta, e.getQuantidade());
        return mapper.toResponse(e);
    }

    /**
     * Reservar ao criar OS — incrementa reservado sem baixar físico.
     * Regra: disponivel >= qtd
     */
    @Transactional
    public EstoqueResponse reservar(UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd reservar deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado para produto " + produtoId + " — cadastre estoque antes de reservar"));
        int disponivel = e.getDisponivel();
        if (disponivel < qtd) {
            throw new IllegalStateException("Estoque insuficiente para reserva: disponivel=" + disponivel + " solicitado=" + qtd + " produto=" + produtoId);
        }
        e.setReservado(e.getReservado() + qtd);
        e.validarInvariantes();
        e = repository.save(e);
        log.info("Estoque reservado loja={} produto={} qtd={} reservado={} disponivel={}", lojaId, produtoId, qtd, e.getReservado(), e.getDisponivel());
        return mapper.toResponse(e);
    }

    /** Overload com lojaId explícito para uso por OS service / listeners */
    @Transactional
    public Estoque reservar(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd deve ser >0");
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado para produto " + produtoId));
        if (e.getDisponivel() < qtd) {
            throw new IllegalStateException("Estoque insuficiente: disponivel=" + e.getDisponivel() + " solicitado=" + qtd);
        }
        e.setReservado(e.getReservado() + qtd);
        e.validarInvariantes();
        return repository.save(e);
    }

    /**
     * Baixar ao ENTREGUE — consome estoque físico e libera reserva.
     * quantidade sai do físico; reservado decrementa se havia reserva.
     */
    @Transactional
    public EstoqueResponse baixarAoEntregue(UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd baixar deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return baixarInternal(lojaId, produtoId, qtd);
    }

    @Transactional
    public Estoque baixar(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd deve ser >0");
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado"));
        // baixa físico
        if (e.getQuantidade() < qtd) {
            throw new IllegalStateException("Estoque físico insuficiente para baixa: quantidade=" + e.getQuantidade() + " solicitado=" + qtd);
        }
        e.setQuantidade(e.getQuantidade() - qtd);
        // libera reserva se houver
        int reservado = e.getReservado();
        if (reservado >= qtd) {
            e.setReservado(reservado - qtd);
        } else if (reservado > 0) {
            // reserva parcial — libera o que houver, restante é venda direta
            e.setReservado(0);
            log.warn("Baixa ENTREGUE com reserva parcial loja={} produto={} reserva={} qtd={}", lojaId, produtoId, reservado, qtd);
        }
        e.validarInvariantes();
        return repository.save(e);
    }

    private EstoqueResponse baixarInternal(UUID lojaId, UUID produtoId, int qtd) {
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado para produto " + produtoId));
        if (e.getQuantidade() < qtd) {
            throw new IllegalStateException("Estoque físico insuficiente: quantidade=" + e.getQuantidade() + " solicitado=" + qtd);
        }
        e.setQuantidade(e.getQuantidade() - qtd);
        if (e.getReservado() >= qtd) {
            e.setReservado(e.getReservado() - qtd);
        } else if (e.getReservado() > 0) {
            e.setReservado(0);
        }
        e.validarInvariantes();
        e = repository.save(e);
        log.info("Estoque baixado ENTREGUE loja={} produto={} qtd={} restante={} reservado={}", lojaId, produtoId, qtd, e.getQuantidade(), e.getReservado());
        return mapper.toResponse(e);
    }

    /**
     * Estornar ao CANCELADO — libera reservado sem mexer no físico.
     */
    @Transactional
    public EstoqueResponse estornarAoCancelado(UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd estorno deve ser >0");
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return estornarInternal(lojaId, produtoId, qtd);
    }

    @Transactional
    public Estoque estornar(UUID lojaId, UUID produtoId, int qtd) {
        if (qtd <= 0) throw new IllegalArgumentException("qtd deve ser >0");
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado"));
        if (e.getReservado() < qtd) {
            throw new IllegalStateException("Reservado insuficiente para estorno: reservado=" + e.getReservado() + " solicitado=" + qtd);
        }
        e.setReservado(e.getReservado() - qtd);
        e.validarInvariantes();
        return repository.save(e);
    }

    private EstoqueResponse estornarInternal(UUID lojaId, UUID produtoId, int qtd) {
        Estoque e = repository.findByProdutoIdAndLojaId(produtoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Estoque não encontrado para produto " + produtoId));
        if (e.getReservado() < qtd) {
            throw new IllegalStateException("Reservado insuficiente para estorno: reservado=" + e.getReservado() + " solicitado=" + qtd + " produto=" + produtoId);
        }
        e.setReservado(e.getReservado() - qtd);
        e.validarInvariantes();
        e = repository.save(e);
        log.info("Estoque estornado CANCELADO loja={} produto={} qtd={} reservado={}", lojaId, produtoId, qtd, e.getReservado());
        return mapper.toResponse(e);
    }
}
