package com.visionbox.modules.ordemservico.service;

import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.estoque.service.EstoqueService;
import com.visionbox.modules.financeiro.service.ContaReceberService;
import com.visionbox.modules.ordemservico.domain.EventoOS;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.dto.AlterarStatusRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
public class OrdemServicoService {

    private final TransicaoOSRegistry registry;
    private final OrdemServicoRepository repository;
    private final OrdemServicoMapper mapper;
    private final Clock clock;
    private final EstoqueService estoqueService;
    private final ContaReceberService contaReceberService;
    private final ProdutoRepository produtoRepository;

    public OrdemServicoMapper getMapper() {
        return mapper;
    }

    // Construtor completo para Spring (injecao via construtor)
    @Autowired
    public OrdemServicoService(TransicaoOSRegistry registry,
                               OrdemServicoRepository repository,
                               OrdemServicoMapper mapper,
                               Clock clock,
                               @Autowired(required = false) EstoqueService estoqueService,
                               @Autowired(required = false) ContaReceberService contaReceberService,
                               @Autowired(required = false) ProdutoRepository produtoRepository) {
        this.registry = registry;
        this.repository = repository;
        this.mapper = mapper;
        this.clock = clock;
        this.estoqueService = estoqueService;
        this.contaReceberService = contaReceberService;
        this.produtoRepository = produtoRepository;
    }

    // Construtor legado para testes unitarios (4 args) — mantem compatibilidade
    public OrdemServicoService(TransicaoOSRegistry registry,
                               OrdemServicoRepository repository,
                               OrdemServicoMapper mapper,
                               Clock clock) {
        this(registry, repository, mapper, clock, null, null, null);
    }

    @Transactional
    public OrdemServicoResponse criar(OrdemServicoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        // numero: OS-YYYY-XXXXX sequencial simplificado; em prod via sequencia_os(loja_id, ano)
        String numero = "OS-" + OffsetDateTime.now(clock).getYear() + "-" + String.format("%05d", ThreadLocalRandom.current().nextInt(1, 99999));
        // garante unicidade tentativa simples
        int tentativas = 0;
        while (repository.findByNumeroAndLojaId(numero, lojaId).isPresent() && tentativas < 3) {
            numero = "OS-" + OffsetDateTime.now(clock).getYear() + "-" + String.format("%05d", ThreadLocalRandom.current().nextInt(1, 99999));
            tentativas++;
        }
        OffsetDateTime previsao = null;
        if (req.getPrevisaoEntrega()!=null && !req.getPrevisaoEntrega().isBlank()) {
            previsao = OffsetDateTime.parse(req.getPrevisaoEntrega());
        } else {
            previsao = OffsetDateTime.now(clock).plusDays(7);
        }
        // Resolver armacao/lente a partir de itens SKU quando ids diretos não vierem (frontend PDV envia SKU)
        UUID efetivaArmacaoId = req.getArmacaoId();
        UUID efetivaLenteId = req.getLenteId();
        java.util.List<UUID> produtosIdsParaReserva = new java.util.ArrayList<>();
        java.util.List<OrdemServicoRequest.ItemRequest> itens = req.getItens();
        if ((efetivaArmacaoId == null && efetivaLenteId == null) && itens != null && !itens.isEmpty() && produtoRepository != null) {
            for (OrdemServicoRequest.ItemRequest it : itens) {
                UUID pid = it.getProdutoId();
                String sku = it.getSku();
                try {
                    if (pid != null) {
                        var opt = produtoRepository.findByIdAndLojaId(pid, lojaId);
                        if (opt.isPresent()) {
                            // tenta classificar para preencher armacao/lente
                            var p = opt.get();
                            if (efetivaArmacaoId == null && p.getTipoProduto() == com.visionbox.modules.catalogo.domain.Produto.TipoProduto.ARMACAO) {
                                efetivaArmacaoId = pid;
                            } else if (efetivaLenteId == null && (p.getTipoProduto() == com.visionbox.modules.catalogo.domain.Produto.TipoProduto.LENTE || p.getTipoProduto() == com.visionbox.modules.catalogo.domain.Produto.TipoProduto.LENTE_CONTATO)) {
                                efetivaLenteId = pid;
                            }
                            produtosIdsParaReserva.add(pid);
                            continue;
                        }
                    }
                    if (sku != null && !sku.isBlank()) {
                        var opt = produtoRepository.findBySkuAndLojaId(sku, lojaId);
                        if (opt.isPresent()) {
                            var p = opt.get();
                            produtosIdsParaReserva.add(p.getId());
                            if (efetivaArmacaoId == null && p.getTipoProduto() == com.visionbox.modules.catalogo.domain.Produto.TipoProduto.ARMACAO) {
                                efetivaArmacaoId = p.getId();
                            } else if (efetivaLenteId == null && (p.getTipoProduto() == com.visionbox.modules.catalogo.domain.Produto.TipoProduto.LENTE || p.getTipoProduto() == com.visionbox.modules.catalogo.domain.Produto.TipoProduto.LENTE_CONTATO)) {
                                efetivaLenteId = p.getId();
                            }
                        } else {
                            log.warn("SKU não encontrado para OS loja={} sku={}", lojaId, sku);
                        }
                    }
                } catch (Exception e) {
                    log.warn("Falha ao resolver SKU {} loja={} erro={}", sku, lojaId, e.getMessage());
                }
            }
        }
        // Se ainda tem ids diretos, garanta que também entrem na lista de reserva
        if (efetivaArmacaoId != null && !produtosIdsParaReserva.contains(efetivaArmacaoId)) produtosIdsParaReserva.add(efetivaArmacaoId);
        if (efetivaLenteId != null && !produtosIdsParaReserva.contains(efetivaLenteId)) produtosIdsParaReserva.add(efetivaLenteId);

        OrdemServico os = OrdemServico.builder()
                .lojaId(lojaId)
                .numero(numero)
                .clienteId(req.getClienteId())
                .receitaId(req.getReceitaId())
                .armacaoId(efetivaArmacaoId)
                .lenteId(efetivaLenteId)
                .laboratorioId(req.getLaboratorioId())
                .status(StatusOS.ORCAMENTO)
                .previsaoEntrega(previsao)
                .build();
        os = repository.save(os);

        EventoOS evento = EventoOS.builder()
                .lojaId(lojaId)
                .ordemServico(os)
                .statusAnterior(null)
                .statusNovo(StatusOS.ORCAMENTO)
                .dataHora(OffsetDateTime.now(clock))
                .responsavel("sistema")
                .observacao(req.getObservacao()!=null?req.getObservacao():"OS criada")
                .build();
        os.addEvento(evento);
        os = repository.save(os);
        log.info("OS criada loja={} numero={} cliente={} armacao={} lente={} itensSKU={}", lojaId, numero, req.getClienteId(), efetivaArmacaoId, efetivaLenteId, itens!=null?itens.size():0);

        // --- Integracao estoque: reservar 1 unidade de armacao/lente ou cada SKU do carrinho ---
        if (estoqueService != null && !produtosIdsParaReserva.isEmpty()) {
            for (UUID pid : produtosIdsParaReserva) {
                // quantidade por item: tenta extrair do itens, default 1
                int qtd = 1;
                if (itens != null) {
                    for (OrdemServicoRequest.ItemRequest it : itens) {
                        if (it.getProdutoId()!=null && it.getProdutoId().equals(pid)) { qtd = it.getQuantidade()!=null&&it.getQuantidade()>0?it.getQuantidade():1; break; }
                        if (it.getSku()!=null && produtoRepository!=null) {
                            try { var opt=produtoRepository.findBySkuAndLojaId(it.getSku(), lojaId); if(opt.isPresent()&&opt.get().getId().equals(pid)){ qtd = it.getQuantidade()!=null&&it.getQuantidade()>0?it.getQuantidade():1; break; } } catch(Exception ignored){}
                        }
                    }
                }
                try {
                    estoqueService.reservar(lojaId, pid, qtd);
                    log.info("Estoque reservado loja={} produto={} qtd={}", lojaId, pid, qtd);
                } catch (Exception e) {
                    log.warn("Falha ao reservar estoque loja={} produto={} erro={}", lojaId, pid, e.getMessage());
                }
            }
        } else if (estoqueService != null) {
            // fallback direto ids (caso produtoRepository nulo e itens eram SKU não resolvidos)
            if (efetivaArmacaoId != null) {
                try { estoqueService.reservar(lojaId, efetivaArmacaoId, 1); log.info("Estoque reservado armacao loja={} produto={}", lojaId, efetivaArmacaoId); } catch (Exception e) { log.warn("Falha ao reservar armacao estoque loja={} produto={} erro={}", lojaId, efetivaArmacaoId, e.getMessage()); }
            }
            if (efetivaLenteId != null) {
                try { estoqueService.reservar(lojaId, efetivaLenteId, 1); log.info("Estoque reservado lente loja={} produto={}", lojaId, efetivaLenteId); } catch (Exception e) { log.warn("Falha ao reservar lente estoque loja={} produto={} erro={}", lojaId, efetivaLenteId, e.getMessage()); }
            }
        }

        // --- Integracao financeiro: gerar ContaReceber ao criar OS com valor total ---
        if (contaReceberService != null) {
            try {
                BigDecimal valorTotal = calcularValorTotal(lojaId, efetivaArmacaoId, efetivaLenteId, itens);
                // aplica desconto PDV se houver (BigDecimal HALF_EVEN)
                if (req.getDesconto()!=null && req.getDesconto().compareTo(BigDecimal.ZERO)>0) {
                    valorTotal = valorTotal.subtract(req.getDesconto()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_EVEN);
                }
                if (valorTotal.compareTo(BigDecimal.ZERO) > 0) {
                    LocalDate vencimento = LocalDate.now(clock).plusDays(30);
                    UUID prev = TenantContext.getCurrentLojaId().orElse(null);
                    try {
                        TenantContext.setCurrentLojaId(lojaId);
                        contaReceberService.gerarAoFechar(req.getClienteId(), null, os.getId(), valorTotal, vencimento, "OS " + os.getNumero() + " - " + os.getStatus());
                    } finally {
                        if (prev == null) TenantContext.clear(); else TenantContext.setCurrentLojaId(prev);
                    }
                    log.info("ContaReceber gerada OS={} valor={} venc={}", os.getNumero(), valorTotal, vencimento);
                }
            } catch (Exception e) {
                log.warn("Falha ao gerar ContaReceber para OS {}: {}", os.getNumero(), e.getMessage());
            }
        }

        return mapper.toResponse(os);
    }

    private BigDecimal calcularValorTotal(UUID lojaId, UUID armacaoId, UUID lenteId, java.util.List<OrdemServicoRequest.ItemRequest> itens) {
        BigDecimal total = BigDecimal.ZERO;
        boolean somouItens = false;
        if (produtoRepository != null && itens != null && !itens.isEmpty()) {
            for (OrdemServicoRequest.ItemRequest it : itens) {
                try {
                    UUID pid = it.getProdutoId();
                    String sku = it.getSku();
                    int qtd = it.getQuantidade()!=null&&it.getQuantidade()>0?it.getQuantidade():1;
                    com.visionbox.modules.catalogo.domain.Produto p = null;
                    if (pid != null) p = produtoRepository.findByIdAndLojaId(pid, lojaId).orElse(null);
                    if (p == null && sku != null) p = produtoRepository.findBySkuAndLojaId(sku, lojaId).orElse(null);
                    if (p != null && p.getPrecoVenda()!=null) {
                        total = total.add(p.getPrecoVenda().multiply(BigDecimal.valueOf(qtd)));
                        somouItens = true;
                    } else {
                        log.warn("Item ignorado no financeiro por produto/preco ausente loja={} sku={} produtoId={}", lojaId, sku, pid);
                    }
                } catch (Exception e) {
                    log.warn("Falha ao calcular item real loja={} sku={} erro={}", lojaId, it.getSku(), e.getMessage());
                }
            }
        }
        if (somouItens) {
            return total.setScale(2, RoundingMode.HALF_EVEN);
        }
        // fallback legado armacao/lente
        if (produtoRepository != null) {
            if (armacaoId != null) {
                try {
                    var opt = produtoRepository.findByIdAndLojaId(armacaoId, lojaId);
                    if (opt.isPresent() && opt.get().getPrecoVenda() != null) total = total.add(opt.get().getPrecoVenda());
                    else log.warn("Armacao ignorada no financeiro por produto/preco ausente loja={} produtoId={}", lojaId, armacaoId);
                } catch (Exception e) { log.warn("Falha ao calcular armacao real loja={} produtoId={} erro={}", lojaId, armacaoId, e.getMessage()); }
            }
            if (lenteId != null) {
                try {
                    var opt = produtoRepository.findByIdAndLojaId(lenteId, lojaId);
                    if (opt.isPresent() && opt.get().getPrecoVenda() != null) total = total.add(opt.get().getPrecoVenda());
                    else log.warn("Lente ignorada no financeiro por produto/preco ausente loja={} produtoId={}", lojaId, lenteId);
                } catch (Exception e) { log.warn("Falha ao calcular lente real loja={} produtoId={} erro={}", lojaId, lenteId, e.getMessage()); }
            }
        }
        return total.setScale(2, RoundingMode.HALF_EVEN);
    }

    // overload legado para compat testes
    private BigDecimal calcularValorTotal(UUID lojaId, UUID armacaoId, UUID lenteId) {
        return calcularValorTotal(lojaId, armacaoId, lenteId, null);
    }

    @Transactional(readOnly = true)
    public Page<OrdemServicoResponse> listar(String status, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Page<OrdemServico> page;
        if (status!=null && !status.isBlank()) {
            StatusOS st = StatusOS.valueOf(status.trim().toUpperCase());
            page = repository.findByLojaIdAndStatus(lojaId, st, pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        return page.map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public OrdemServicoResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("OS não encontrada"));
        return mapper.toResponse(os);
    }

    @Transactional
    public OrdemServicoResponse avancar(UUID id, AlterarStatusRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        StatusOS novo = StatusOS.valueOf(req.getNovoStatus().trim().toUpperCase());
        OrdemServico os = avancarInternal(lojaId, id, novo, req.getResponsavel(), req.getObservacao());
        return mapper.toResponse(os);
    }

    // método legado usado por testes unitários: avancar(lojaId, id, novo, responsavel, obs)
    @Transactional
    public OrdemServico avancar(UUID lojaId, UUID ordemServicoId, StatusOS novoStatus, String responsavel, String observacao) {
        return avancarInternal(lojaId, ordemServicoId, novoStatus, responsavel, observacao);
    }

    private OrdemServico avancarInternal(UUID lojaId, UUID ordemServicoId, StatusOS novoStatus, String responsavel, String observacao) {
        OrdemServico os = repository.findByIdAndLojaId(ordemServicoId, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("OS não encontrada para loja"));

        StatusOS anterior = os.getStatus();
        registry.validarTransicao(anterior, novoStatus);

        if (novoStatus == StatusOS.ENVIADO_LABORATORIO) {
            if (os.getArmacaoId() == null && os.getLenteId() == null) {
                throw new IllegalStateException("ENVIADO_LABORATORIO exige armação ou lente vinculada");
            }
        }

        os.setStatus(novoStatus);

        if (anterior == StatusOS.RETRABALHO || novoStatus == StatusOS.RETRABALHO) {
            os.setPrevisaoEntrega(OffsetDateTime.now(clock).plusDays(7));
        } else if (novoStatus == StatusOS.ENTREGUE) {
            os.setDataEntregaReal(OffsetDateTime.now(clock));
        }

        EventoOS evento = EventoOS.builder()
                .lojaId(lojaId)
                .ordemServico(os)
                .statusAnterior(anterior)
                .statusNovo(novoStatus)
                .dataHora(OffsetDateTime.now(clock))
                .responsavel(responsavel!=null?responsavel:"sistema")
                .observacao(observacao)
                .build();

        os.addEvento(evento);
        OrdemServico saved = repository.save(os);

        // --- Integracao estoque em transicoes terminais ---
        if (estoqueService != null) {
            try {
                if (novoStatus == StatusOS.ENTREGUE) {
                    // Baixar estoque fisico e liberar reserva — tarefa exige baixarAoEntregue
                    safeBaixarAoEntregue(lojaId, os.getArmacaoId());
                    safeBaixarAoEntregue(lojaId, os.getLenteId());
                } else if (novoStatus == StatusOS.CANCELADO) {
                    // Estornar reserva sem baixar fisico
                    safeEstornar(lojaId, os.getArmacaoId());
                    safeEstornar(lojaId, os.getLenteId());
                }
            } catch (Exception e) {
                log.warn("Falha movimentacao estoque avancar OS={} {}->{} erro={}", saved.getNumero(), anterior, novoStatus, e.getMessage());
            }
        }

        return saved;
    }

    private void safeBaixarAoEntregue(UUID lojaId, UUID produtoId) {
        if (produtoId == null || estoqueService == null) return;
        try {
            // caminho preferencial com lojaId explicito (multi-tenant seguro)
            estoqueService.baixar(lojaId, produtoId, 1);
            log.info("Estoque baixar ENTREGUE loja={} produto={}", lojaId, produtoId);
        } catch (Exception ex) {
            log.warn("baixar(lojaId) falhou, tentando baixarAoEntregue fallback: {}", ex.getMessage());
            try {
                UUID prev = TenantContext.getCurrentLojaId().orElse(null);
                try {
                    TenantContext.setCurrentLojaId(lojaId);
                    estoqueService.baixarAoEntregue(produtoId, 1);
                    log.info("Estoque baixarAoEntregue OK loja={} produto={}", lojaId, produtoId);
                } finally {
                    if (prev == null) TenantContext.clear(); else TenantContext.setCurrentLojaId(prev);
                }
            } catch (Exception e2) {
                log.warn("Falha baixarAoEntregue produto={} erro={}", produtoId, e2.getMessage());
            }
        }
    }

    private void safeEstornar(UUID lojaId, UUID produtoId) {
        if (produtoId == null || estoqueService == null) return;
        try {
            estoqueService.estornar(lojaId, produtoId, 1);
            log.info("Estoque estornar CANCELADO loja={} produto={}", lojaId, produtoId);
        } catch (Exception ex) {
            log.warn("estornar(lojaId) falhou, tentando estornarAoCancelado fallback: {}", ex.getMessage());
            try {
                UUID prev = TenantContext.getCurrentLojaId().orElse(null);
                try {
                    TenantContext.setCurrentLojaId(lojaId);
                    estoqueService.estornarAoCancelado(produtoId, 1);
                    log.info("Estoque estornarAoCancelado OK loja={} produto={}", lojaId, produtoId);
                } finally {
                    if (prev == null) TenantContext.clear(); else TenantContext.setCurrentLojaId(prev);
                }
            } catch (Exception e2) {
                log.warn("Falha estornarAoCancelado produto={} erro={}", produtoId, e2.getMessage());
            }
        }
    }

    @Transactional(readOnly = true)
    public OrdemServico buscarEntidade(UUID lojaId, UUID id) {
        return repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("OS não encontrada"));
    }
}
