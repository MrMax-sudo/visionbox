package com.visionbox.modules.ordemservico.service;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.estoque.service.EstoqueService;
import com.visionbox.modules.financeiro.comissao.dto.ApurarComissaoRequest;
import com.visionbox.modules.financeiro.comissao.service.ComissaoService;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.maquininha.domain.MaquininhaCartao;
import com.visionbox.modules.financeiro.maquininha.domain.TipoCartao;
import com.visionbox.modules.financeiro.maquininha.dto.ResultadoMdr;
import com.visionbox.modules.financeiro.maquininha.repository.MaquininhaCartaoRepository;
import com.visionbox.modules.financeiro.maquininha.service.MdrCalculoService;
import com.visionbox.modules.financeiro.service.ContaReceberService;
import com.visionbox.modules.ordemservico.domain.EventoOS;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.OrdemServicoPagamento;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.dto.AlterarStatusRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoRequest;
import com.visionbox.modules.ordemservico.dto.OrdemServicoResponse;
import com.visionbox.modules.ordemservico.mapper.OrdemServicoMapper;
import com.visionbox.modules.ordemservico.repository.OrdemServicoPagamentoRepository;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.shared.metrics.SlaMetrics;
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
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

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
    private final OrdemServicoPagamentoRepository pagamentoRepository;
    private final FormaPagamentoRepository formaPagamentoRepository;
    private final ClienteRepository clienteRepository;
    private final SlaMetrics slaMetrics;
    private final RastreioTokenService rastreioTokenService;
    private final com.visionbox.modules.seguranca.desconto.service.AutorizacaoDescontoService autorizacaoDescontoService;
    private final MaquininhaCartaoRepository maquininhaRepository;
    private final MdrCalculoService mdrCalculoService;
    private final ComissaoService comissaoService;

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
                               @Autowired(required = false) ProdutoRepository produtoRepository,
                               @Autowired(required = false) OrdemServicoPagamentoRepository pagamentoRepository,
                               @Autowired(required = false) FormaPagamentoRepository formaPagamentoRepository,
                               @Autowired(required = false) ClienteRepository clienteRepository,
                               @Autowired(required = false) SlaMetrics slaMetrics,
                               @Autowired(required = false) RastreioTokenService rastreioTokenService,
                               @Autowired(required = false) com.visionbox.modules.seguranca.desconto.service.AutorizacaoDescontoService autorizacaoDescontoService,
                               @Autowired(required = false) MaquininhaCartaoRepository maquininhaRepository,
                               @Autowired(required = false) MdrCalculoService mdrCalculoService,
                               @Autowired(required = false) ComissaoService comissaoService) {
        this.registry = registry;
        this.repository = repository;
        this.mapper = mapper;
        this.clock = clock;
        this.estoqueService = estoqueService;
        this.contaReceberService = contaReceberService;
        this.produtoRepository = produtoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.formaPagamentoRepository = formaPagamentoRepository;
        this.clienteRepository = clienteRepository;
        this.slaMetrics = slaMetrics;
        this.rastreioTokenService = rastreioTokenService;
        this.autorizacaoDescontoService = autorizacaoDescontoService;
        this.maquininhaRepository = maquininhaRepository;
        this.mdrCalculoService = mdrCalculoService;
        this.comissaoService = comissaoService;
    }

    // Construtor legado para testes unitarios (4 args) — mantem compatibilidade
    public OrdemServicoService(TransicaoOSRegistry registry,
                               OrdemServicoRepository repository,
                               OrdemServicoMapper mapper,
                               Clock clock) {
        this(registry, repository, mapper, clock, null, null, null, null, null, null, null, null, null, null, null, null);
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

        // Se vier com pagamentos registrados ou forma de pagamento do PDV, a venda foi concluída -> PEDIDO_CONFIRMADO
        boolean ehVendaConcluida = (req.getPagamentos() != null && !req.getPagamentos().isEmpty())
                || (req.getFormaPagamento() != null && !req.getFormaPagamento().isBlank());
        StatusOS statusInicial = ehVendaConcluida ? StatusOS.PEDIDO_CONFIRMADO : StatusOS.ORCAMENTO;

        OrdemServico os = OrdemServico.builder()
                .lojaId(lojaId)
                .numero(numero)
                .clienteId(req.getClienteId())
                .receitaId(req.getReceitaId())
                .armacaoId(efetivaArmacaoId)
                .lenteId(efetivaLenteId)
                .laboratorioId(req.getLaboratorioId())
                .status(statusInicial)
                .previsaoEntrega(previsao)
                .build();
        os = repository.save(os);

        EventoOS evento = EventoOS.builder()
                .lojaId(lojaId)
                .ordemServico(os)
                .statusAnterior(null)
                .statusNovo(statusInicial)
                .dataHora(OffsetDateTime.now(clock))
                .responsavel("sistema")
                .observacao(req.getObservacao() != null ? req.getObservacao() : (ehVendaConcluida ? "Venda PDV confirmada com pagamento" : "Orçamento criado"))
                .build();
        os.addEvento(evento);
        os = repository.save(os);
        log.info("OS criada loja={} numero={} status={} cliente={} armacao={} lente={} itensSKU={}", lojaId, numero, statusInicial, req.getClienteId(), efetivaArmacaoId, efetivaLenteId, itens!=null?itens.size():0);

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

        // --- Pagamentos multi-forma (PDV novo fluxo: FinalizarVendaModal) + MDR (§3.5) ---
        if (pagamentoRepository != null && req.getPagamentos() != null && !req.getPagamentos().isEmpty()) {
            for (OrdemServicoRequest.PagamentoRequest pg : req.getPagamentos()) {
                if (pg.getFormaPagamentoId() == null || pg.getValor() == null) continue;
                BigDecimal valorPg = pg.getValor().setScale(2, RoundingMode.HALF_EVEN);
                FormaPagamento forma = null;
                String formaNome = null;
                if (formaPagamentoRepository != null) {
                    try {
                        var opt = formaPagamentoRepository.findByIdAndLojaId(pg.getFormaPagamentoId(), lojaId);
                        if (opt.isPresent()) {
                            forma = opt.get();
                            formaNome = forma.getNome();
                        }
                    } catch (Exception e) {
                        log.warn("Forma de pagamento {} não resolvida loja={} erro={}", pg.getFormaPagamentoId(), lojaId, e.getMessage());
                    }
                }
                OrdemServicoPagamento osp = OrdemServicoPagamento.builder()
                        .lojaId(lojaId)
                        .ordemServicoId(os.getId())
                        .formaPagamentoId(pg.getFormaPagamentoId())
                        .valor(valorPg)
                        .formaPagamentoNome(formaNome)
                        .parcelas(parcelasEfetivas(forma, pg, lojaId))
                        .build();
                aplicarMdr(osp, forma, pg, lojaId);
                pagamentoRepository.save(osp);
                log.info("Pagamento OS {} forma={} valor={} parcelas={} taxa={} liquido={}", os.getNumero(),
                        formaNome != null ? formaNome : pg.getFormaPagamentoId(), valorPg,
                        osp.getParcelas(), osp.getTaxaValor(), osp.getValorLiquido());
            }
        }

        // --- Validacao de alcada de desconto server-side (D-010 / P8) ---
        BigDecimal valorBruto = calcularValorTotal(lojaId, efetivaArmacaoId, efetivaLenteId, itens);
        if (req.getDesconto() != null && req.getDesconto().compareTo(BigDecimal.ZERO) > 0) {
            if (valorBruto.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal percentual = req.getDesconto().multiply(BigDecimal.valueOf(100))
                        .divide(valorBruto, 2, RoundingMode.HALF_EVEN);
                if (com.visionbox.modules.seguranca.desconto.domain.AlcadaDesconto.exigePin(percentual) && autorizacaoDescontoService != null) {
                    UUID solicitanteId = null;
                    var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.getPrincipal() instanceof com.visionbox.modules.usuario.domain.Usuario u) {
                        solicitanteId = u.getId();
                    }
                    var authReq = new com.visionbox.modules.seguranca.desconto.dto.AutorizacaoDescontoRequest(percentual, req.getSenhaAutorizacao());
                    var authResp = autorizacaoDescontoService.autorizar(authReq, lojaId, solicitanteId, null, null);
                    if (!authResp.autorizado()) {
                        throw new IllegalArgumentException("Desconto de " + percentual + "% exige autorização gerencial. " +
                                (authResp.mensagem() != null ? authResp.mensagem() : "Senha não autorizada."));
                    }
                }
            }
        }

        // --- Integracao financeiro: gerar ContaReceber ao criar OS com valor total ---
        if (contaReceberService != null) {
            try {
                BigDecimal valorTotal = valorBruto;
                // aplica desconto PDV se houver (BigDecimal HALF_EVEN)
                if (req.getDesconto()!=null && req.getDesconto().compareTo(BigDecimal.ZERO)>0) {
                    valorTotal = valorTotal.subtract(req.getDesconto()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_EVEN);
                }
                if (valorTotal.compareTo(BigDecimal.ZERO) > 0) {
                    LocalDate vencimento = LocalDate.now(clock).plusDays(30);
                    UUID prev = TenantContext.getCurrentLojaId().orElse(null);
                    try {
                        TenantContext.setCurrentLojaId(lojaId);
                        String descTitulo = ehVendaConcluida ? ("Venda OS " + os.getNumero()) : ("Orçamento OS " + os.getNumero());
                        contaReceberService.gerarAoFechar(req.getClienteId(), null, os.getId(), valorTotal, vencimento, descTitulo);
                    } finally {
                        if (prev == null) TenantContext.clear(); else TenantContext.setCurrentLojaId(prev);
                    }
                    log.info("ContaReceber gerada OS={} valor={} venc={}", os.getNumero(), valorTotal, vencimento);
                }
            } catch (Exception e) {
                log.warn("Falha ao gerar ContaReceber para OS {}: {}", os.getNumero(), e.getMessage());
            }
        }

        // --- Comissão automática (§3.6): apura na finalização da venda (PEDIDO_CONFIRMADO com pagamento).
        // Síncrona com try/catch (padrão do repo — não há barramento de eventos no fluxo):
        // falha NUNCA quebra a venda; WARN e segue. Idempotente por (venda, vendedor) no ComissaoService.
        if (ehVendaConcluida && comissaoService != null) {
            try {
                BigDecimal valorTotalVenda = valorBruto;
                if (req.getDesconto() != null && req.getDesconto().compareTo(BigDecimal.ZERO) > 0) {
                    valorTotalVenda = valorTotalVenda.subtract(req.getDesconto()).max(BigDecimal.ZERO)
                            .setScale(2, RoundingMode.HALF_EVEN);
                }
                if (valorTotalVenda.compareTo(BigDecimal.ZERO) > 0) {
                    UUID vendedorId = null;
                    var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.getPrincipal() instanceof com.visionbox.modules.usuario.domain.Usuario u) {
                        vendedorId = u.getId();
                    }
                    if (vendedorId == null) {
                        log.warn("Comissão não apurada para OS {}: venda sem vendedor identificado no contexto de segurança", os.getNumero());
                    } else {
                        ApurarComissaoRequest apurReq = ApurarComissaoRequest.builder()
                                .vendaId(os.getId())
                                .vendaNumero(os.getNumero())
                                .vendedorId(vendedorId)
                                .valorTotal(valorTotalVenda)
                                .itens(montarItensApuracao(lojaId, req.getItens(), valorTotalVenda))
                                .build();
                        UUID prev = TenantContext.getCurrentLojaId().orElse(null);
                        try {
                            TenantContext.setCurrentLojaId(lojaId);
                            var lancamentos = comissaoService.apurar(apurReq);
                            log.info("Comissão apurada OS={} vendedor={} lancamentos={}", os.getNumero(), vendedorId, lancamentos.size());
                        } finally {
                            if (prev == null) TenantContext.clear(); else TenantContext.setCurrentLojaId(prev);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Falha ao apurar comissão da OS {} (venda persistida): {}", os.getNumero(), e.getMessage());
            }
        }

        return enriquecer(mapper.toResponse(os), lojaId);
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

    /**
     * MDR (§3.5) sobre um pagamento da venda — nunca lança exceção (falha não pode quebrar a venda).
     * Padrão de persistência (V37):
     * <ul>
     *   <li>não-cartão identificado (DINHEIRO/PIX/CREDIARIO): taxaValor = 0, valorLiquido = valor (isento);</li>
     *   <li>cartão com maquininha resolvida: taxa/liquido de {@link MdrCalculoService} (HALF_EVEN 2 casas);</li>
     *   <li>cartão sem maquininha (0 ou >1 ativas sem id no payload) ou falha: campos null — MDR pendente
     *       para a conciliação posterior. Nunca chuta taxa (R3: dado comercial vem do cadastro da loja).</li>
     * </ul>
     */
    private void aplicarMdr(OrdemServicoPagamento osp, FormaPagamento forma,
                            OrdemServicoRequest.PagamentoRequest pg, UUID lojaId) {
        boolean ehCartao = forma != null
                && (forma.getTipo() == FormaPagamento.TipoFormaPagamento.DEBITO
                    || forma.getTipo() == FormaPagamento.TipoFormaPagamento.CREDITO);
        if (!ehCartao) {
            if (forma != null) {
                // forma não-cartão identificada: isenta de MDR — líquido conhecido
                osp.setTaxaValor(BigDecimal.ZERO);
                osp.setValorLiquido(osp.getValor());
            }
            // forma não resolvida: sem MDR (campos null)
            return;
        }
        try {
            MaquininhaCartao maquininha = resolverMaquininha(pg.getMaquininhaId(), lojaId);
            if (maquininha == null) {
                log.warn("MDR pendente: maquininha não resolvida loja={} forma={} valor={} — pagamento cartão sem taxa aplicada",
                        lojaId, forma.getNome(), osp.getValor());
                return;
            }
            TipoCartao tipo = forma.getTipo() == FormaPagamento.TipoFormaPagamento.DEBITO
                    ? TipoCartao.DEBITO : TipoCartao.CREDITO;
            // parcelas efetivas já resolvidas e persistidas (V40) — fonte única do cálculo
            int parcelas = osp.getParcelas() != null ? osp.getParcelas() : 1;
            ResultadoMdr mdr = mdrCalculoService.calcular(osp.getValor(), maquininha, tipo, parcelas);
            osp.setTaxaValor(mdr.getTaxaValor());
            osp.setValorLiquido(mdr.getValorLiquido());
            osp.setMaquininhaId(mdr.getMaquininhaId());
        } catch (Exception e) {
            log.warn("Falha ao calcular MDR loja={} formaPagamento={} erro={} — pagamento persistido sem taxa (pendente)",
                    lojaId, pg.getFormaPagamentoId(), e.getMessage());
        }
    }

    /**
     * Parcelas efetivas do pagamento (§3.5), persistidas desde V40 (default 1).
     * Mesma regra do cálculo MDR: crédito parcelável usa o payload do PDV; crédito
     * sem {@code permiteParcelar} é clampado a 1 com WARN; débito/não-cartão = 1.
     */
    private int parcelasEfetivas(FormaPagamento forma, OrdemServicoRequest.PagamentoRequest pg, UUID lojaId) {
        if (forma == null || forma.getTipo() != FormaPagamento.TipoFormaPagamento.CREDITO) return 1;
        if (pg.getParcelas() == null || pg.getParcelas() <= 1) return 1;
        if (!forma.isPermiteParcelar()) {
            log.warn("Forma {} não permite parcelar: parcelas {} ajustadas para 1 loja={}",
                    forma.getNome(), pg.getParcelas(), lojaId);
            return 1;
        }
        return pg.getParcelas();
    }

    /**
     * Vinculação maquininha↔pagamento (§3.5):
     * <ol>
     *   <li>id explícito no payload do PDV ({@code PagamentoRequest.maquininhaId}), validado por loja (R1);</li>
     *   <li>senão, auto-resolve quando a loja tem exatamente uma maquininha ativa;</li>
     *   <li>zero ou mais de uma ativa sem id explícito → null (MDR pendente) — nunca escolhe taxa no escuro.</li>
     * </ol>
     */
    private MaquininhaCartao resolverMaquininha(UUID maquininhaId, UUID lojaId) {
        if (maquininhaRepository == null || mdrCalculoService == null) return null;
        try {
            if (maquininhaId != null) {
                return maquininhaRepository.findByIdAndLojaId(maquininhaId, lojaId).orElse(null);
            }
            List<MaquininhaCartao> ativas = maquininhaRepository.findByLojaIdAndAtivoTrue(lojaId);
            if (ativas.size() == 1) return ativas.get(0);
            log.warn("MDR pendente: loja={} tem {} maquininha(s) ativa(s) e pagamento sem maquininhaId",
                    lojaId, ativas.size());
            return null;
        } catch (Exception e) {
            log.warn("Falha ao resolver maquininha loja={} erro={}", lojaId, e.getMessage());
            return null;
        }
    }

    /**
     * Itens de apuração de comissão (§3.6): categoria + subtotal por item, com o desconto
     * rateado proporcionalmente (fator liquido/bruto) para que a soma das bases nunca exceda
     * o valorTotal — evita rejeição da validação de {@code ComissaoService.apurar} em vendas
     * com desconto. O último item absorve o arredondamento.
     * Sem itens resolvidos devolve null: apurar() aplica só a regra GERAL sobre o total.
     */
    private List<ApurarComissaoRequest.ItemApuracao> montarItensApuracao(UUID lojaId,
                                                                         List<OrdemServicoRequest.ItemRequest> itens,
                                                                         BigDecimal valorTotalVenda) {
        if (produtoRepository == null || itens == null || itens.isEmpty()) return null;
        try {
            List<ApurarComissaoRequest.ItemApuracao> apuracao = new ArrayList<>();
            BigDecimal bruto = BigDecimal.ZERO;
            for (OrdemServicoRequest.ItemRequest it : itens) {
                Produto p = null;
                if (it.getProdutoId() != null) {
                    p = produtoRepository.findByIdAndLojaId(it.getProdutoId(), lojaId).orElse(null);
                }
                if (p == null && it.getSku() != null && !it.getSku().isBlank()) {
                    p = produtoRepository.findBySkuAndLojaId(it.getSku(), lojaId).orElse(null);
                }
                if (p == null || p.getPrecoVenda() == null || p.getCategoria() == null) continue;
                int qtd = it.getQuantidade() != null && it.getQuantidade() > 0 ? it.getQuantidade() : 1;
                BigDecimal subtotal = p.getPrecoVenda().multiply(BigDecimal.valueOf(qtd))
                        .setScale(2, RoundingMode.HALF_EVEN);
                if (subtotal.compareTo(BigDecimal.ZERO) <= 0) continue;
                apuracao.add(new ApurarComissaoRequest.ItemApuracao(p.getCategoria(), subtotal));
                bruto = bruto.add(subtotal);
            }
            if (apuracao.isEmpty() || bruto.compareTo(BigDecimal.ZERO) <= 0) return null;
            BigDecimal liquido = valorTotalVenda.min(bruto).setScale(2, RoundingMode.HALF_EVEN);
            if (liquido.compareTo(bruto) >= 0) return apuracao; // sem desconto efetivo
            BigDecimal fator = liquido.divide(bruto, 6, RoundingMode.HALF_EVEN);
            BigDecimal acumulado = BigDecimal.ZERO;
            for (int i = 0; i < apuracao.size(); i++) {
                ApurarComissaoRequest.ItemApuracao item = apuracao.get(i);
                if (i == apuracao.size() - 1) {
                    item.setSubtotal(liquido.subtract(acumulado).max(BigDecimal.ZERO)); // absorve arredondamento
                } else {
                    BigDecimal novo = item.getSubtotal().multiply(fator).setScale(2, RoundingMode.HALF_EVEN);
                    acumulado = acumulado.add(novo);
                    item.setSubtotal(novo);
                }
            }
            return apuracao;
        } catch (Exception e) {
            log.warn("Falha ao montar itens de apuração de comissão loja={} erro={} — degradando para regra GERAL",
                    lojaId, e.getMessage());
            return null;
        }
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
        return enriquecerPagina(page.map(mapper::toResponse), lojaId);
    }

    @Transactional(readOnly = true)
    public OrdemServicoResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("OS não encontrada"));
        return enriquecer(mapper.toResponse(os), lojaId);
    }

    @Transactional
    public OrdemServicoResponse avancar(UUID id, AlterarStatusRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        StatusOS novo = StatusOS.valueOf(req.getNovoStatus().trim().toUpperCase());
        OrdemServico os = avancarInternal(lojaId, id, novo, req.getResponsavel(), req.getObservacao());
        return enriquecer(mapper.toResponse(os), lojaId);
    }

    private OrdemServicoResponse enriquecer(OrdemServicoResponse resp, UUID lojaId) {
        if (resp == null) return null;
        anexarPagamentos(List.of(resp), lojaId);
        if (rastreioTokenService != null && resp.getId() != null && lojaId != null) {
            try {
                resp.setTokenRastreio(rastreioTokenService.gerar(lojaId, resp.getId()));
            } catch (Exception e) {
                log.warn("Falha ao gerar token de rastreio para OS {}: {}", resp.getNumero(), e.getMessage());
            }
        }
        if (resp.getClienteId() == null || clienteRepository == null) return resp;
        try {
            clienteRepository.findByIdAndLojaId(resp.getClienteId(), lojaId).ifPresent(c -> {
                resp.setClienteNome(c.getNome());
                resp.setClienteWhatsapp(c.getWhatsapp());
            });
        } catch (Exception e) {
            log.warn("Falha ao enriquecer cliente da OS {}: {}", resp.getNumero(), e.getMessage());
        }
        return resp;
    }

    private Page<OrdemServicoResponse> enriquecerPagina(Page<OrdemServicoResponse> page, UUID lojaId) {
        if (page.getContent().isEmpty()) return page;
        // pagamentos da página em UMA query (lote por ids de OS — N+1 proibido)
        anexarPagamentos(page.getContent(), lojaId);
        if (clienteRepository == null) return page;
        try {
            Set<UUID> ids = page.getContent().stream()
                    .map(OrdemServicoResponse::getClienteId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            if (ids.isEmpty()) return page;
            Map<UUID, Cliente> clientes = clienteRepository.findByLojaIdAndIdIn(lojaId, ids).stream()
                    .collect(Collectors.toMap(Cliente::getId, c -> c));
            page.getContent().forEach(resp -> {
                Cliente c = resp.getClienteId() != null ? clientes.get(resp.getClienteId()) : null;
                if (c != null) {
                    resp.setClienteNome(c.getNome());
                    resp.setClienteWhatsapp(c.getWhatsapp());
                }
            });
        } catch (Exception e) {
            log.warn("Falha ao enriquecer clientes da listagem de OS: {}", e.getMessage());
        }
        return page;
    }

    /**
     * Anexa os pagamentos (§3.5) às respostas de OS em LOTE — uma única query de
     * pagamento por chamada ({@code findAllByLojaIdAndOrdemServicoIdIn}) para 1 ou N
     * OS (single e página), nunca por OS (N+1 proibido). {@code formaPagamentoNome}
     * usa o snapshot da linha (V26, usado no relatório de caixa); snapshot ausente é
     * resolvido em lote por {@code formaPagamentoId} (R1 — escopo por loja).
     * Falha degrada para lista vazia com WARN (enriquecimento não quebra leitura).
     */
    private void anexarPagamentos(List<OrdemServicoResponse> resps, UUID lojaId) {
        if (pagamentoRepository == null || resps == null || resps.isEmpty() || lojaId == null) return;
        try {
            List<UUID> osIds = resps.stream()
                    .map(OrdemServicoResponse::getId)
                    .filter(Objects::nonNull)
                    .toList();
            if (osIds.isEmpty()) return;
            Map<UUID, List<OrdemServicoPagamento>> porOs = pagamentoRepository
                    .findAllByLojaIdAndOrdemServicoIdIn(lojaId, osIds).stream()
                    .collect(Collectors.groupingBy(OrdemServicoPagamento::getOrdemServicoId));
            // nomes faltantes (snapshot V26 nulo) resolvidos em UMA query por forma_pagamento_id
            Set<UUID> formasSemNome = porOs.values().stream()
                    .flatMap(List::stream)
                    .filter(p -> (p.getFormaPagamentoNome() == null || p.getFormaPagamentoNome().isBlank())
                            && p.getFormaPagamentoId() != null)
                    .map(OrdemServicoPagamento::getFormaPagamentoId)
                    .collect(Collectors.toSet());
            Map<UUID, String> nomes = resolverNomesFormas(lojaId, formasSemNome);
            for (OrdemServicoResponse resp : resps) {
                List<OrdemServicoPagamento> pags = resp.getId() != null ? porOs.get(resp.getId()) : null;
                resp.setPagamentos(pags == null
                        ? List.of()
                        : pags.stream().map(p -> toPagamentoResponse(p, nomes)).toList());
            }
        } catch (Exception e) {
            log.warn("Falha ao anexar pagamentos à resposta de OS loja={}: {}", lojaId, e.getMessage());
            resps.forEach(r -> r.setPagamentos(List.of()));
        }
    }

    private Map<UUID, String> resolverNomesFormas(UUID lojaId, Set<UUID> formasIds) {
        if (formasIds.isEmpty() || formaPagamentoRepository == null) return Map.of();
        try {
            return formaPagamentoRepository.findByLojaIdAndIdIn(lojaId, formasIds).stream()
                    .collect(Collectors.toMap(FormaPagamento::getId, f -> f.getNome() != null ? f.getNome() : ""));
        } catch (Exception e) {
            log.warn("Falha ao resolver nomes de formas de pagamento em lote loja={}: {}", lojaId, e.getMessage());
            return Map.of();
        }
    }

    private OrdemServicoResponse.PagamentoResponse toPagamentoResponse(OrdemServicoPagamento p, Map<UUID, String> nomes) {
        String nome = p.getFormaPagamentoNome() != null && !p.getFormaPagamentoNome().isBlank()
                ? p.getFormaPagamentoNome()
                : nomes.get(p.getFormaPagamentoId());
        return OrdemServicoResponse.PagamentoResponse.builder()
                .id(p.getId())
                .formaPagamentoId(p.getFormaPagamentoId())
                .formaPagamentoNome(nome)
                .valor(p.getValor())
                .taxaValor(p.getTaxaValor())      // null = MDR pendente (V37 tri-state)
                .valorLiquido(p.getValorLiquido()) // null = MDR pendente
                .maquininhaId(p.getMaquininhaId())  // null = MDR não aplicado
                .parcelas(p.getParcelas() != null ? p.getParcelas() : 1) // default 1 (V40)
                .build();
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

        // Métrica: lead time laboratório (SLA) — janela ENVIADO_LABORATORIO (fallback PEDIDO_CONFIRMADO)
        // → PRONTO_PARA_RETIRADA. Só contabiliza a primeira vez que a OS chega em PRONTO_PARA_RETIRADA.
        if (slaMetrics != null && novoStatus == StatusOS.PRONTO_PARA_RETIRADA
                && anterior != StatusOS.PRONTO_PARA_RETIRADA && os.getHistorico() != null) {
            OffsetDateTime inicio = os.getHistorico().stream()
                    .filter(e -> e.getStatusNovo() == StatusOS.ENVIADO_LABORATORIO)
                    .map(EventoOS::getDataHora)
                    .min(OffsetDateTime::compareTo)
                    .or(() -> os.getHistorico().stream()
                            .filter(e -> e.getStatusNovo() == StatusOS.PEDIDO_CONFIRMADO)
                            .map(EventoOS::getDataHora)
                            .min(OffsetDateTime::compareTo))
                    .orElse(null);
            if (inicio != null) {
                slaMetrics.registrarLeadTimeLaboratorio(saved.getLaboratorioId(),
                        Duration.between(inicio, OffsetDateTime.now(clock)));
            }
        }

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

        // --- Estorno de comissoes PENDENTES no cancelamento (follow-up D-017):
        // a venda cancelada não pode deixar lançamento PENDENTE órfão. Falha NUNCA
        // quebra a transição de status (try/catch WARN, mesmo padrão do estoque). ---
        if (novoStatus == StatusOS.CANCELADO) {
            safeCancelarComissao(lojaId, saved.getId(),
                    observacao != null && !observacao.isBlank() ? observacao : "OS " + saved.getNumero() + " cancelada");
        }

        return saved;
    }

    /**
     * Estorna as comissões PENDENTES da venda (venda_id = OS id) no cancelamento —
     * idempotente (segunda chamada não encontra PENDENTE). Falha é só WARN:
     * o cancelamento da OS NUNCA é bloqueado por comissão (follow-up D-017).
     */
    private void safeCancelarComissao(UUID lojaId, UUID vendaId, String motivo) {
        if (comissaoService == null || vendaId == null) return;
        try {
            int estornadas = comissaoService.cancelarPorVenda(lojaId, vendaId, motivo);
            log.info("Comissões estornadas no cancelamento loja={} os/venda={} quantidade={}", lojaId, vendaId, estornadas);
        } catch (Exception e) {
            log.warn("Falha ao estornar comissões da OS/venda {} loja={} (cancelamento prossegue): {}",
                    vendaId, lojaId, e.getMessage());
        }
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

    @Transactional
    public OrdemServicoResponse atualizarPrevisaoEntrega(UUID id, OffsetDateTime novaPrevisao, String motivo, String operador) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("OS não encontrada"));

        OffsetDateTime antiga = os.getPrevisaoEntrega();
        os.setPrevisaoEntrega(novaPrevisao);
        os.setAlertaAtrasoDisparado(false);

        EventoOS evento = EventoOS.builder()
                .lojaId(lojaId)
                .ordemServico(os)
                .statusAnterior(os.getStatus())
                .statusNovo(os.getStatus())
                .dataHora(OffsetDateTime.now(clock))
                .responsavel(operador != null && !operador.isBlank() ? operador : "operador")
                .observacao("Prazo de entrega atualizado para " + novaPrevisao.toString() + (motivo != null && !motivo.isBlank() ? " — Motivo: " + motivo : ""))
                .build();
        os.addEvento(evento);
        os = repository.save(os);
        log.info("Prazo de entrega atualizado loja={} id={} novaPrevisao={}", lojaId, id, novaPrevisao);
        return mapper.toResponse(os);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> buscarAlertas() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);
        OffsetDateTime umDiaAtras = agora.minusDays(1);
        List<StatusOS> concluidos = List.of(StatusOS.ENTREGUE, StatusOS.CANCELADO, StatusOS.DEVOLVIDO_GARANTIA);

        List<OrdemServicoResponse> atrasadas = repository
                .findByLojaIdAndPrevisaoEntregaBeforeAndStatusNotIn(lojaId, agora, concluidos)
                .stream()
                .map(mapper::toResponse)
                .toList();

        List<OrdemServicoResponse> semMovimentacao = repository
                .findSemMovimentacao(lojaId, umDiaAtras, concluidos)
                .stream()
                .map(mapper::toResponse)
                .toList();

        return Map.of(
                "totalAtrasadas", atrasadas.size(),
                "atrasadas", atrasadas,
                "totalSemMovimentacao", semMovimentacao.size(),
                "semMovimentacao", semMovimentacao
        );
    }
}
