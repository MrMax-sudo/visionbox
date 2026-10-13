package com.visionbox.modules.vendas.service;

import com.visionbox.modules.catalogo.domain.Produto;
import com.visionbox.modules.catalogo.repository.ProdutoRepository;
import com.visionbox.modules.estoque.service.EstoqueService;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.modules.fiscal.DocumentoFiscal;
import com.visionbox.modules.fiscal.repository.DocumentoFiscalRepository;
import com.visionbox.modules.ordemservico.domain.EventoOS;
import com.visionbox.modules.ordemservico.domain.OrdemServico;
import com.visionbox.modules.ordemservico.domain.OrdemServicoPagamento;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.domain.TransicaoOSRegistry;
import com.visionbox.modules.ordemservico.repository.OrdemServicoPagamentoRepository;
import com.visionbox.modules.ordemservico.repository.OrdemServicoRepository;
import com.visionbox.modules.pessoa.domain.Cliente;
import com.visionbox.modules.pessoa.repository.ClienteRepository;
import com.visionbox.modules.vendas.dto.CancelarVendaRequest;
import com.visionbox.modules.vendas.dto.VendaItemViewDTO;
import com.visionbox.modules.vendas.dto.VendaKpisDTO;
import com.visionbox.modules.vendas.dto.VendaPagamentoViewDTO;
import com.visionbox.modules.vendas.dto.VendaViewDTO;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Serviço central de histórico e gestão de vendas (Outbox ERP benchmark: ConsultaVendaService).
 * Unifica ordens de serviço do balcão/PDV, pagamentos multi-forma, documentos fiscais (NFC-e)
 * e contas a receber.
 */
@Slf4j
@Service
public class VendaHistoricoService {

    private final OrdemServicoRepository ordemServicoRepository;
    private final OrdemServicoPagamentoRepository pagamentoRepository;
    private final DocumentoFiscalRepository documentoFiscalRepository;
    private final ContaReceberRepository contaReceberRepository;
    private final ClienteRepository clienteRepository;
    private final ProdutoRepository produtoRepository;
    private final TransicaoOSRegistry transicaoRegistry;
    private final EstoqueService estoqueService;
    private final com.visionbox.modules.financeiro.comissao.service.ComissaoService comissaoService;
    private final Clock clock;

    @Autowired
    public VendaHistoricoService(
            OrdemServicoRepository ordemServicoRepository,
            @Autowired(required = false) OrdemServicoPagamentoRepository pagamentoRepository,
            @Autowired(required = false) DocumentoFiscalRepository documentoFiscalRepository,
            @Autowired(required = false) ContaReceberRepository contaReceberRepository,
            @Autowired(required = false) ClienteRepository clienteRepository,
            @Autowired(required = false) ProdutoRepository produtoRepository,
            TransicaoOSRegistry transicaoRegistry,
            @Autowired(required = false) EstoqueService estoqueService,
            @Autowired(required = false) com.visionbox.modules.financeiro.comissao.service.ComissaoService comissaoService,
            Clock clock) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.documentoFiscalRepository = documentoFiscalRepository;
        this.contaReceberRepository = contaReceberRepository;
        this.clienteRepository = clienteRepository;
        this.produtoRepository = produtoRepository;
        this.transicaoRegistry = transicaoRegistry;
        this.estoqueService = estoqueService;
        this.comissaoService = comissaoService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<VendaViewDTO> listar(
            LocalDate dataInicio,
            LocalDate dataFim,
            String status,
            String statusFiscal,
            String search,
            Pageable pageable) {

        UUID lojaId = TenantContext.requireCurrentLojaId();

        OffsetDateTime inicio = dataInicio != null ? dataInicio.atStartOfDay().atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime fim = dataFim != null ? dataFim.atTime(23, 59, 59, 999999999).atOffset(ZoneOffset.UTC) : null;

        StatusOS statusOS = null;
        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("TODOS")) {
            try {
                statusOS = StatusOS.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                log.warn("Status de venda desconhecido: {}", status);
            }
        }

        String numeroFiltro = null;
        UUID clienteIdFiltro = null;

        if (search != null && !search.isBlank()) {
            String q = search.trim();
            // Se parecer com número de OS
            if (q.toUpperCase().startsWith("OS-") || q.matches("^\\d+$")) {
                numeroFiltro = q;
            } else if (clienteRepository != null) {
                // Tenta achar cliente por nome
                List<Cliente> clientes = clienteRepository.findByLojaIdAndNomeContainingIgnoreCase(lojaId, q, PageRequest.of(0, 5)).getContent();
                if (!clientes.isEmpty()) {
                    clienteIdFiltro = clientes.get(0).getId();
                } else {
                    numeroFiltro = q; // fallback para busca textual em numero
                }
            } else {
                numeroFiltro = q;
            }
        }

        Page<OrdemServico> osPage = ordemServicoRepository.buscarComFiltros(
                lojaId, inicio, fim, statusOS, numeroFiltro, clienteIdFiltro, pageable);

        List<VendaViewDTO> dtos = enriquecerEmLote(osPage.getContent(), lojaId);

        // Se filtro de statusFiscal específico for solicitado
        if (statusFiscal != null && !statusFiscal.isBlank() && !statusFiscal.equalsIgnoreCase("TODOS")) {
            String sfTarget = statusFiscal.trim().toUpperCase();
            List<VendaViewDTO> filtrados = dtos.stream()
                    .filter(v -> sfTarget.equalsIgnoreCase(v.getStatusFiscal()))
                    .toList();
            return new PageImpl<>(filtrados, pageable, osPage.getTotalElements());
        }

        return new PageImpl<>(dtos, pageable, osPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public VendaViewDTO buscarPorId(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = ordemServicoRepository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Venda / OS não encontrada: " + id));

        List<VendaViewDTO> lista = enriquecerEmLote(List.of(os), lojaId);
        return lista.isEmpty() ? null : lista.get(0);
    }

    @Transactional(readOnly = true)
    public VendaKpisDTO obterKpis(LocalDate dataInicio, LocalDate dataFim) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        OffsetDateTime inicio = dataInicio != null ? dataInicio.atStartOfDay().atOffset(ZoneOffset.UTC) : LocalDate.now().minusDays(30).atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime fim = dataFim != null ? dataFim.atTime(23, 59, 59, 999999999).atOffset(ZoneOffset.UTC) : LocalDate.now().atTime(23, 59, 59, 999999999).atOffset(ZoneOffset.UTC);

        // Varre até 5000 vendas no período para agregar KPIs com precisão
        Page<OrdemServico> osPage = ordemServicoRepository.buscarComFiltros(
                lojaId, inicio, fim, null, null, null, PageRequest.of(0, 5000, Sort.by(Sort.Direction.DESC, "criadoEm")));

        List<OrdemServico> ordens = osPage.getContent();
        if (ordens.isEmpty()) {
            return VendaKpisDTO.builder()
                    .totalVendas(0)
                    .faturamentoTotal(BigDecimal.ZERO)
                    .ticketMedio(BigDecimal.ZERO)
                    .cuponsEmitidos(0)
                    .cuponsNaoEmitidos(0)
                    .totalCanceladas(0)
                    .build();
        }

        List<VendaViewDTO> enriquecidas = enriquecerEmLote(ordens, lojaId);

        long totalVendas = 0;
        long totalCanceladas = 0;
        BigDecimal faturamentoTotal = BigDecimal.ZERO;
        long cuponsEmitidos = 0;
        long cuponsNaoEmitidos = 0;

        for (VendaViewDTO v : enriquecidas) {
            if ("CANCELADO".equalsIgnoreCase(v.getStatus())) {
                totalCanceladas++;
            } else {
                totalVendas++;
                if (v.getValorTotal() != null) {
                    faturamentoTotal = faturamentoTotal.add(v.getValorTotal());
                }
                if ("AUTORIZADO".equalsIgnoreCase(v.getStatusFiscal())) {
                    cuponsEmitidos++;
                } else {
                    cuponsNaoEmitidos++;
                }
            }
        }

        BigDecimal ticketMedio = totalVendas > 0
                ? faturamentoTotal.divide(BigDecimal.valueOf(totalVendas), 2, RoundingMode.HALF_EVEN)
                : BigDecimal.ZERO;

        return VendaKpisDTO.builder()
                .totalVendas(totalVendas)
                .faturamentoTotal(faturamentoTotal.setScale(2, RoundingMode.HALF_EVEN))
                .ticketMedio(ticketMedio)
                .cuponsEmitidos(cuponsEmitidos)
                .cuponsNaoEmitidos(cuponsNaoEmitidos)
                .totalCanceladas(totalCanceladas)
                .build();
    }

    @Transactional
    public VendaViewDTO cancelar(UUID id, CancelarVendaRequest request) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        OrdemServico os = ordemServicoRepository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Venda não encontrada para cancelamento: " + id));

        StatusOS anterior = os.getStatus();
        if (anterior == StatusOS.CANCELADO) {
            throw new IllegalStateException("Esta venda já está cancelada.");
        }

        // Validação da máquina de estados
        transicaoRegistry.validarTransicao(anterior, StatusOS.CANCELADO);

        os.setStatus(StatusOS.CANCELADO);

        String responsavel = "sistema";
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
            responsavel = auth.getName();
        }

        EventoOS evento = EventoOS.builder()
                .lojaId(lojaId)
                .ordemServico(os)
                .statusAnterior(anterior)
                .statusNovo(StatusOS.CANCELADO)
                .dataHora(OffsetDateTime.now(clock))
                .responsavel(responsavel)
                .observacao("Cancelamento de venda: " + (request.getMotivo() != null ? request.getMotivo() : "Sem motivo informado"))
                .build();
        os.addEvento(evento);
        os = ordemServicoRepository.save(os);

        // Estorno de estoque para armação e lentes
        if (estoqueService != null) {
            if (os.getArmacaoId() != null) {
                try {
                    estoqueService.estornar(lojaId, os.getArmacaoId(), 1);
                    log.info("Estoque armação estornado loja={} os={} prod={}", lojaId, os.getNumero(), os.getArmacaoId());
                } catch (Exception e) {
                    log.warn("Falha ao estornar armação da OS {}: {}", os.getNumero(), e.getMessage());
                }
            }
            if (os.getLenteId() != null) {
                try {
                    estoqueService.estornar(lojaId, os.getLenteId(), 1);
                    log.info("Estoque lente estornado loja={} os={} prod={}", lojaId, os.getNumero(), os.getLenteId());
                } catch (Exception e) {
                    log.warn("Falha ao estornar lente da OS {}: {}", os.getNumero(), e.getMessage());
                }
            }
        }

        // Cancelamento no financeiro (contas a receber)
        if (contaReceberRepository != null) {
            try {
                List<ContaReceber> contas = contaReceberRepository.findByLojaIdAndOrdemServicoId(lojaId, os.getId());
                for (ContaReceber cr : contas) {
                    if (cr.getStatus() != ContaReceber.StatusConta.CANCELADO) {
                        cr.setStatus(ContaReceber.StatusConta.CANCELADO);
                        contaReceberRepository.save(cr);
                        log.info("ContaReceber cancelada para OS {}: id={}", os.getNumero(), cr.getId());
                    }
                }
            } catch (Exception e) {
                log.warn("Falha ao cancelar contas a receber da OS {}: {}", os.getNumero(), e.getMessage());
            }
        }

        // Estorno de comissões PENDENTES da venda (follow-up D-017: "OS cancelada
        // após venda deixa lançamento PENDENTE"). Falha NUNCA quebra o cancelamento
        // (try/catch WARN — mesmo padrão do estoque/contas a receber acima).
        if (comissaoService != null) {
            try {
                int estornadas = comissaoService.cancelarPorVenda(lojaId, os.getId(), request.getMotivo());
                log.info("Comissões estornadas no cancelamento da OS {}: {} lançamento(s)",
                        os.getNumero(), estornadas);
            } catch (Exception e) {
                log.warn("Falha ao estornar comissões da OS {} (cancelamento prossegue): {}",
                        os.getNumero(), e.getMessage());
            }
        }

        log.info("Venda OS {} cancelada com sucesso na loja {}. Motivo: {}", os.getNumero(), lojaId, request.getMotivo());
        List<VendaViewDTO> lista = enriquecerEmLote(List.of(os), lojaId);
        return lista.isEmpty() ? null : lista.get(0);
    }

    private List<VendaViewDTO> enriquecerEmLote(List<OrdemServico> ordens, UUID lojaId) {
        if (ordens == null || ordens.isEmpty()) return Collections.emptyList();

        List<UUID> osIds = ordens.stream().map(OrdemServico::getId).toList();

        // 1. Clientes em lote
        Set<UUID> clienteIds = ordens.stream().map(OrdemServico::getClienteId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Cliente> clientesMap = new HashMap<>();
        if (clienteRepository != null && !clienteIds.isEmpty()) {
            try {
                clientesMap = clienteRepository.findByLojaIdAndIdIn(lojaId, clienteIds).stream()
                        .collect(Collectors.toMap(Cliente::getId, c -> c));
            } catch (Exception e) {
                log.warn("Erro ao buscar clientes em lote para vendas: {}", e.getMessage());
            }
        }

        // 2. Pagamentos em lote
        Map<UUID, List<OrdemServicoPagamento>> pagamentosPorOs = new HashMap<>();
        if (pagamentoRepository != null) {
            try {
                List<OrdemServicoPagamento> pags = pagamentoRepository.findAllByLojaIdAndOrdemServicoIdIn(lojaId, osIds);
                pagamentosPorOs = pags.stream().collect(Collectors.groupingBy(OrdemServicoPagamento::getOrdemServicoId));
            } catch (Exception e) {
                log.warn("Erro ao buscar pagamentos em lote para vendas: {}", e.getMessage());
            }
        }

        // 3. Documentos fiscais em lote (NFC-e / NF-e)
        Map<UUID, DocumentoFiscal> docFiscalPorOs = new HashMap<>();
        if (documentoFiscalRepository != null) {
            try {
                List<DocumentoFiscal> docs = documentoFiscalRepository.findAllByLojaIdAndOrdemServicoIdIn(lojaId, osIds);
                // Pega o mais recente por OS
                docFiscalPorOs = docs.stream()
                        .sorted(Comparator.comparing(DocumentoFiscal::getCriadoEm).reversed())
                        .collect(Collectors.toMap(
                                DocumentoFiscal::getOrdemServicoId,
                                d -> d,
                                (existente, substituto) -> existente));
            } catch (Exception e) {
                log.warn("Erro ao buscar documentos fiscais em lote para vendas: {}", e.getMessage());
            }
        }

        // 4. Produtos (armação e lente) em lote
        Set<UUID> produtoIds = ordens.stream()
                .flatMap(os -> Stream.of(os.getArmacaoId(), os.getLenteId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Produto> produtosMap = new HashMap<>();
        if (produtoRepository != null && !produtoIds.isEmpty()) {
            try {
                produtosMap = produtoRepository.findAllById(produtoIds).stream()
                        .filter(p -> lojaId.equals(p.getLojaId()))
                        .collect(Collectors.toMap(Produto::getId, p -> p));
            } catch (Exception e) {
                log.warn("Erro ao buscar produtos em lote para vendas: {}", e.getMessage());
            }
        }

        List<VendaViewDTO> resultado = new ArrayList<>(ordens.size());
        for (OrdemServico os : ordens) {
            Cliente cli = os.getClienteId() != null ? clientesMap.get(os.getClienteId()) : null;
            List<OrdemServicoPagamento> pags = pagamentosPorOs.getOrDefault(os.getId(), Collections.emptyList());
            DocumentoFiscal df = docFiscalPorOs.get(os.getId());

            // Itens
            List<VendaItemViewDTO> itens = new ArrayList<>();
            BigDecimal somaItens = BigDecimal.ZERO;

            if (os.getArmacaoId() != null) {
                Produto p = produtosMap.get(os.getArmacaoId());
                BigDecimal preco = p != null && p.getPrecoVenda() != null ? p.getPrecoVenda() : BigDecimal.ZERO;
                somaItens = somaItens.add(preco);
                itens.add(VendaItemViewDTO.builder()
                        .produtoId(os.getArmacaoId())
                        .sku(p != null ? p.getSku() : null)
                        .nome(p != null ? p.getNome() : "Armação")
                        .quantidade(1)
                        .precoUnitario(preco)
                        .subtotal(preco)
                        .tipoProduto("ARMACAO")
                        .build());
            }

            if (os.getLenteId() != null) {
                Produto p = produtosMap.get(os.getLenteId());
                BigDecimal preco = p != null && p.getPrecoVenda() != null ? p.getPrecoVenda() : BigDecimal.ZERO;
                somaItens = somaItens.add(preco);
                itens.add(VendaItemViewDTO.builder()
                        .produtoId(os.getLenteId())
                        .sku(p != null ? p.getSku() : null)
                        .nome(p != null ? p.getNome() : "Lente Oftálmica")
                        .quantidade(1)
                        .precoUnitario(preco)
                        .subtotal(preco)
                        .tipoProduto("LENTE")
                        .build());
            }

            // Pagamentos
            List<VendaPagamentoViewDTO> pagamentosDTO = new ArrayList<>();
            BigDecimal somaPagamentos = BigDecimal.ZERO;
            List<String> formasNomes = new ArrayList<>();

            for (OrdemServicoPagamento p : pags) {
                pagamentosDTO.add(VendaPagamentoViewDTO.builder()
                        .id(p.getId())
                        .formaPagamentoId(p.getFormaPagamentoId())
                        .formaPagamentoNome(p.getFormaPagamentoNome())
                        .valor(p.getValor())
                        .build());
                if (p.getValor() != null) {
                    somaPagamentos = somaPagamentos.add(p.getValor());
                }
                if (p.getFormaPagamentoNome() != null && !p.getFormaPagamentoNome().isBlank()) {
                    formasNomes.add(p.getFormaPagamentoNome());
                }
            }

            // Determina valor total: pagamentos -> contaReceber -> itens
            BigDecimal valorTotal = somaPagamentos;
            if (valorTotal.compareTo(BigDecimal.ZERO) == 0 && contaReceberRepository != null) {
                try {
                    List<ContaReceber> crs = contaReceberRepository.findByLojaIdAndOrdemServicoId(lojaId, os.getId());
                    if (!crs.isEmpty()) {
                        valorTotal = crs.stream()
                                .map(ContaReceber::getValor)
                                .filter(Objects::nonNull)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                    }
                } catch (Exception ignored) {}
            }
            if (valorTotal.compareTo(BigDecimal.ZERO) == 0 && somaItens.compareTo(BigDecimal.ZERO) > 0) {
                valorTotal = somaItens;
            }

            String formaPagamentoStr = !formasNomes.isEmpty()
                    ? String.join(", ", formasNomes)
                    : (pagamentosDTO.isEmpty() ? "Não informada" : "Diversos");

            // Dados Fiscais
            String statusFiscalStr = "NAO_EMITIDO";
            String modeloFiscalStr = null;
            String serieFiscalStr = null;
            Integer numeroFiscalInt = null;
            String chaveAcessoStr = null;
            String protocoloFiscalStr = null;
            OffsetDateTime dataAutFiscal = null;
            String motivoFiscalStr = null;
            String qrCodeUrlStr = null;

            if (df != null) {
                statusFiscalStr = df.getStatus() != null ? df.getStatus().name() : "PENDENTE";
                modeloFiscalStr = df.getModelo() != null ? df.getModelo().name() : null;
                serieFiscalStr = df.getSerie();
                numeroFiscalInt = df.getNumero();
                chaveAcessoStr = df.getChaveAcesso();
                protocoloFiscalStr = df.getProtocolo();
                dataAutFiscal = df.getDhAutorizacao();
                motivoFiscalStr = df.getMotivo();
                if (chaveAcessoStr != null && !chaveAcessoStr.isBlank()) {
                    qrCodeUrlStr = "https://www.sefaz.gov.br/nfce/qrcode?chNFe=" + chaveAcessoStr;
                }
            }

            // Extrai observação do último evento ou descrição
            String observacao = null;
            if (os.getHistorico() != null && !os.getHistorico().isEmpty()) {
                observacao = os.getHistorico().get(os.getHistorico().size() - 1).getObservacao();
            }

            VendaViewDTO dto = VendaViewDTO.builder()
                    .id(os.getId())
                    .numero(os.getNumero())
                    .dataHora(os.getCriadoEm())
                    .clienteId(os.getClienteId())
                    .clienteNome(cli != null ? cli.getNome() : "Consumidor")
                    .clienteTelefone(cli != null ? cli.getTelefone() : null)
                    .clienteWhatsapp(cli != null ? cli.getWhatsapp() : null)
                    .clienteCpf(cli != null && cli.getCpfHash() != null ? "***.***.***-**" : null)
                    .status(os.getStatus() != null ? os.getStatus().name() : "DESCONHECIDO")
                    .statusDescricao(formatarStatus(os.getStatus()))
                    .subtotal(somaItens.compareTo(BigDecimal.ZERO) > 0 ? somaItens : valorTotal)
                    .desconto(BigDecimal.ZERO)
                    .valorTotal(valorTotal)
                    .formaPagamento(formaPagamentoStr)
                    .statusFiscal(statusFiscalStr)
                    .modeloFiscal(modeloFiscalStr)
                    .serieFiscal(serieFiscalStr)
                    .numeroFiscal(numeroFiscalInt)
                    .chaveAcesso(chaveAcessoStr)
                    .protocoloFiscal(protocoloFiscalStr)
                    .dataAutorizacaoFiscal(dataAutFiscal)
                    .qrCodeUrl(qrCodeUrlStr)
                    .motivoFiscal(motivoFiscalStr)
                    .itens(itens)
                    .pagamentos(pagamentosDTO)
                    .observacao(observacao)
                    .build();

            resultado.add(dto);
        }

        return resultado;
    }

    private String formatarStatus(StatusOS status) {
        if (status == null) return "Desconhecido";
        return switch (status) {
            case ORCAMENTO -> "Orçamento";
            case PEDIDO_CONFIRMADO -> "Venda Confirmada";
            case ENVIADO_LABORATORIO -> "No Laboratório";
            case EM_PRODUCAO -> "Em Produção";
            case LENTE_PRONTA -> "Lente Pronta";
            case MONTAGEM -> "Em Montagem";
            case CONTROLE_QUALIDADE -> "Controle de Qualidade";
            case PRONTO_PARA_RETIRADA -> "Pronto para Retirada";
            case ENTREGUE -> "Entregue";
            case CANCELADO -> "Cancelada";
            case DEVOLVIDO_GARANTIA -> "Garantia / Devolvido";
            case RETRABALHO -> "Retrabalho";
        };
    }
}
