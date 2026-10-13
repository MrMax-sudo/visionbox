package com.visionbox.modules.financeiro.comissao.service;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoConfig;
import com.visionbox.modules.financeiro.comissao.domain.ComissaoLancamento;
import com.visionbox.modules.financeiro.comissao.dto.ApurarComissaoRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigRequest;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoConfigResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoFechamentoResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoLancamentoResponse;
import com.visionbox.modules.financeiro.comissao.dto.ComissaoVendedorResponse;
import com.visionbox.modules.financeiro.comissao.mapper.ComissaoMapper;
import com.visionbox.modules.financeiro.comissao.repository.ComissaoConfigRepository;
import com.visionbox.modules.financeiro.comissao.repository.ComissaoLancamentoRepository;
import com.visionbox.modules.usuario.domain.Perfil;
import com.visionbox.modules.usuario.domain.Usuario;
import com.visionbox.modules.usuario.repository.UsuarioRepository;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Comissões de vendedores (§3.6).
 * <p>
 * Regras: percentual GERAL sobre o total da venda, ou percentual por CATEGORIA de produto.
 * A base da regra GERAL exclui as bases já cobertas por regra de categoria — sem dupla cobrança
 * (o Outbox ERP somava global sobre o total E por categoria; aqui evitamos o duplo conto — D-016).
 * Sem itens informados, apenas a regra GERAL apura.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComissaoService {

    private final ComissaoConfigRepository configRepository;
    private final ComissaoLancamentoRepository lancamentoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ComissaoMapper mapper;

    // ------------------------------------------------------------------
    // Configuração de regras
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ComissaoConfigResponse> listarConfigs() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return configRepository.findByLojaIdAndAtivoTrue(lojaId).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public ComissaoConfigResponse criarConfig(ComissaoConfigRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        validarConfig(lojaId, null, req);
        ComissaoConfig cfg = ComissaoConfig.builder()
                .lojaId(lojaId)
                .tipo(req.getTipo())
                .categoria(req.getTipo() == ComissaoConfig.TipoComissao.CATEGORIA
                        ? req.getCategoria().trim() : null)
                .percentual(req.getPercentual().setScale(2, RoundingMode.HALF_EVEN))
                .ativo(req.getAtivo() == null || req.getAtivo())
                .build();
        ComissaoConfig salva = configRepository.save(cfg);
        log.info("ComissaoConfig criada loja={} id={} tipo={} pct={}", lojaId, salva.getId(),
                salva.getTipo(), salva.getPercentual());
        return mapper.toResponse(salva);
    }

    @Transactional
    public ComissaoConfigResponse atualizarConfig(UUID id, ComissaoConfigRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ComissaoConfig cfg = configRepository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Regra de comissão não encontrada"));
        validarConfig(lojaId, id, req);
        cfg.setTipo(req.getTipo());
        cfg.setCategoria(req.getTipo() == ComissaoConfig.TipoComissao.CATEGORIA
                ? (req.getCategoria() != null ? req.getCategoria().trim() : null) : null);
        cfg.setPercentual(req.getPercentual().setScale(2, RoundingMode.HALF_EVEN));
        if (req.getAtivo() != null) cfg.setAtivo(req.getAtivo());
        return mapper.toResponse(configRepository.save(cfg));
    }

    @Transactional
    public void removerConfig(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ComissaoConfig cfg = configRepository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Regra de comissão não encontrada"));
        cfg.setAtivo(false);
        configRepository.save(cfg);
    }

    private void validarConfig(UUID lojaId, UUID idAtual, ComissaoConfigRequest req) {
        if (req.getTipo() == ComissaoConfig.TipoComissao.CATEGORIA
                && (req.getCategoria() == null || req.getCategoria().isBlank())) {
            throw new IllegalArgumentException("categoria é obrigatória para tipo CATEGORIA");
        }
        List<ComissaoConfig> ativas = configRepository.findByLojaIdAndAtivoTrue(lojaId);
        for (ComissaoConfig a : ativas) {
            if (idAtual != null && a.getId().equals(idAtual)) continue;
            boolean mesmaGeral = req.getTipo() == ComissaoConfig.TipoComissao.GERAL
                    && a.getTipo() == ComissaoConfig.TipoComissao.GERAL;
            boolean mesmaCategoria = req.getTipo() == ComissaoConfig.TipoComissao.CATEGORIA
                    && a.getTipo() == ComissaoConfig.TipoComissao.CATEGORIA
                    && a.getCategoria() != null
                    && a.getCategoria().equalsIgnoreCase(req.getCategoria().trim());
            if (mesmaGeral) {
                throw new IllegalArgumentException("Já existe regra GERAL ativa para esta loja");
            }
            if (mesmaCategoria) {
                throw new IllegalArgumentException("Já existe regra ativa para a categoria '" + req.getCategoria().trim() + "'");
            }
        }
    }

    // ------------------------------------------------------------------
    // Apuração (§3.6)
    // ------------------------------------------------------------------

    /**
     * Apura comissão da venda para o vendedor. Idempotente por (venda, vendedor):
     * repetir a chamada não duplica lançamento (índice único parcial em V35 também barra corrida).
     */
    @Transactional
    public List<ComissaoLancamentoResponse> apurar(ApurarComissaoRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();

        if (req.getVendaId() != null) {
            List<ComissaoLancamento> existentes =
                    lancamentoRepository.findByLojaIdAndVendaIdAndVendedorIdAndAtivoTrue(
                            lojaId, req.getVendaId(), req.getVendedorId());
            if (!existentes.isEmpty()) {
                log.info("Comissão já apurada loja={} venda={} vendedor={} — retornando {} lançamento(s)",
                        lojaId, req.getVendaId(), req.getVendedorId(), existentes.size());
                return existentes.stream().map(mapper::toLancamentoResponse).toList();
            }
        }

        List<ComissaoConfig> configs = configRepository.findByLojaIdAndAtivoTrue(lojaId);
        if (configs.isEmpty()) {
            log.info("Nenhuma regra de comissão ativa loja={} — nada a apurar", lojaId);
            return List.of();
        }

        List<ComissaoLancamento> novos = new ArrayList<>();
        BigDecimal baseCategorias = BigDecimal.ZERO;
        String vendedorNome = resolverVendedorNome(lojaId, req);

        boolean temItens = req.getItens() != null && !req.getItens().isEmpty();
        if (temItens) {
            for (ComissaoConfig cfg : configs) {
                if (cfg.getTipo() != ComissaoConfig.TipoComissao.CATEGORIA) continue;
                BigDecimal base = somarBasePorCategoria(req.getItens(), cfg.getCategoria());
                if (base.compareTo(BigDecimal.ZERO) > 0) {
                    novos.add(novoLancamento(lojaId, req, vendedorNome, cfg, base, cfg.getCategoria()));
                    baseCategorias = baseCategorias.add(base);
                }
            }
        }

        if (baseCategorias.compareTo(req.getValorTotal()) > 0) {
            throw new IllegalArgumentException(
                    "soma dos subtotais por categoria (" + baseCategorias
                            + ") excede valorTotal da venda (" + req.getValorTotal() + ")");
        }

        final BigDecimal baseCategoriasFinal = baseCategorias;
        configs.stream()
                .filter(c -> c.getTipo() == ComissaoConfig.TipoComissao.GERAL)
                .findFirst()
                .ifPresent(geral -> {
                    BigDecimal baseGeral = req.getValorTotal().subtract(baseCategoriasFinal);
                    if (baseGeral.compareTo(BigDecimal.ZERO) > 0) {
                        novos.add(novoLancamento(lojaId, req, vendedorNome, geral, baseGeral, null));
                    }
                });

        if (novos.isEmpty()) {
            log.info("Apuração sem lançamento loja={} venda={} (sem regra aplicável)", lojaId, req.getVendaId());
            return List.of();
        }
        List<ComissaoLancamento> salvos = lancamentoRepository.saveAll(novos);
        log.info("Comissão apurada loja={} venda={} vendedor={} lancamentos={}",
                lojaId, req.getVendaId(), req.getVendedorId(), salvos.size());
        return salvos.stream().map(mapper::toLancamentoResponse).toList();
    }

    private ComissaoLancamento novoLancamento(UUID lojaId, ApurarComissaoRequest req, String vendedorNome,
                                              ComissaoConfig cfg, BigDecimal base, String categoria) {
        BigDecimal valor = base.multiply(cfg.getPercentual())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_EVEN);
        return ComissaoLancamento.builder()
                .lojaId(lojaId)
                .vendaId(req.getVendaId())
                .vendaNumero(req.getVendaNumero())
                .vendedorId(req.getVendedorId())
                .vendedorNome(vendedorNome)
                .categoria(categoria)
                .baseCalculo(base.setScale(2, RoundingMode.HALF_EVEN))
                .percentualAplicado(cfg.getPercentual())
                .valorComissao(valor)
                .status(ComissaoLancamento.StatusComissao.PENDENTE)
                .dataLancamento(OffsetDateTime.now())
                .build();
    }

    private BigDecimal somarBasePorCategoria(List<ApurarComissaoRequest.ItemApuracao> itens, String categoria) {
        BigDecimal base = BigDecimal.ZERO;
        for (ApurarComissaoRequest.ItemApuracao it : itens) {
            if (it == null || it.getSubtotal() == null || it.getCategoria() == null) continue;
            if (it.getCategoria().trim().equalsIgnoreCase(categoria)) {
                base = base.add(it.getSubtotal());
            }
        }
        return base;
    }

    private String resolverVendedorNome(UUID lojaId, ApurarComissaoRequest req) {
        if (req.getVendedorNome() != null && !req.getVendedorNome().isBlank()) {
            return req.getVendedorNome().trim();
        }
        return usuarioRepository.findByIdAndLojaId(req.getVendedorId(), lojaId)
                .map(Usuario::getNome)
                .orElse(null);
    }

    // ------------------------------------------------------------------
    // Estorno no cancelamento da venda (§3.6 — follow-up D-017)
    // ------------------------------------------------------------------

    /**
     * Estorna (status CANCELADO) os lançamentos PENDENTES da venda, escopados à
     * loja (R1). Fecha a lacuna do D-017: "OS cancelada após venda deixa
     * lançamento PENDENTE" — o cancelamento da venda/agora estorna a comissão
     * que ainda não foi paga.
     * <p>
     * Regras:
     * <ul>
     *   <li>só PENDENTE → CANCELADO; lançamento PAGO NÃO é tocado — dinheiro já
     *       pago ao vendedor, estorno é pendência de folha (WARN com os ids);</li>
     *   <li>idempotente: segunda chamada não encontra PENDENTE → 0, sem erro;</li>
     *   <li>{@code ComissaoLancamento} não tem campo motivo — o motivo do
     *       cancelamento fica registrado em log (status CANCELADO é a evidência
     *       estrutural; a venda cancelada registra o porquê no EventoOS).</li>
     * </ul>
     *
     * @param lojaId  tenant (R1) — explícito: o chamador pode estar em fluxo com
     *                contexto próprio (cancelamento de venda/OS)
     * @param vendaId id da venda (= id da OS no fluxo PDV)
     * @param motivo  motivo do cancelamento (só log — não há coluna motivo)
     * @return quantidade de lançamentos estornados (0 = nada a fazer)
     */
    @Transactional
    public int cancelarPorVenda(UUID lojaId, UUID vendaId, String motivo) {
        if (lojaId == null || vendaId == null) {
            log.warn("Estorno de comissão ignorado: lojaId/vendaId nulos (motivo={})", motivo);
            return 0;
        }
        List<ComissaoLancamento> daVenda = lancamentoRepository.findByLojaIdAndVendaIdAndAtivoTrue(lojaId, vendaId);
        List<ComissaoLancamento> pendentes = new ArrayList<>();
        List<ComissaoLancamento> pagos = new ArrayList<>();
        for (ComissaoLancamento l : daVenda) {
            if (l.getStatus() == ComissaoLancamento.StatusComissao.PENDENTE) pendentes.add(l);
            else if (l.getStatus() == ComissaoLancamento.StatusComissao.PAGO) pagos.add(l);
        }
        if (pendentes.isEmpty()) {
            log.info("Nenhuma comissão PENDENTE para estornar loja={} venda={} ({} PAGO) motivo={}",
                    lojaId, vendaId, pagos.size(), motivo);
            return 0;
        }
        for (ComissaoLancamento l : pendentes) {
            l.setStatus(ComissaoLancamento.StatusComissao.CANCELADO);
        }
        lancamentoRepository.saveAll(pendentes);
        log.info("Comissões estornadas (PENDENTE→CANCELADO) loja={} venda={} quantidade={} motivo={}",
                lojaId, vendaId, pendentes.size(), motivo);
        if (!pagos.isEmpty()) {
            // PAGO não é tocado: dinheiro já saiu para o vendedor — pendência de folha
            log.warn("Venda {} cancelada com {} comissão(ões) já PAGAS — estorno manual na folha necessário loja={} lancamentos={}",
                    vendaId, pagos.size(), lojaId,
                    pagos.stream().map(l -> String.valueOf(l.getId())).toList());
        }
        return pendentes.size();
    }

    // ------------------------------------------------------------------
    // Vendedores que apuram comissão (§3.6) — picker da apuração/fechamento
    // ------------------------------------------------------------------

    /**
     * Perfis de venda/atendimento da ótica que apuram comissão. O plano de robustez
     * (§3.6) vincula o lançamento "à venda e ao consultor ótico/vendedor" e o
     * {@code Perfil} marca VENDEDOR (PDV/cliente) e OTICO (grau/receita) como quem
     * atende/vende. A apuração em si aceita qualquer usuarioId da loja — esta lista
     * só alimenta o seletor da UI.
     */
    private static final List<Perfil> PERFIS_APURAM_COMISSAO = List.of(Perfil.VENDEDOR, Perfil.OTICO);

    /**
     * Vendedores ATIVOS da loja corrente com perfil que apura comissão, ordenados
     * por nome. Filtro de ativo é explícito no repositório porque {@code Usuario}
     * NÃO tem @SQLRestriction (D-004). Sem email/PII — minimização LGPD (R7).
     */
    @Transactional(readOnly = true)
    public List<ComissaoVendedorResponse> listarVendedores() {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        return usuarioRepository.findByLojaIdAndPerfilInAndAtivoTrue(lojaId, PERFIS_APURAM_COMISSAO).stream()
                .sorted(Comparator.comparing(Usuario::getNome, String.CASE_INSENSITIVE_ORDER))
                .map(u -> new ComissaoVendedorResponse(u.getId(), u.getNome()))
                .toList();
    }

    // ------------------------------------------------------------------
    // Fechamento por período (§3.6)
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ComissaoFechamentoResponse fechamento(LocalDate dataInicio, LocalDate dataFim, UUID vendedorId) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        if (dataInicio == null || dataFim == null) {
            throw new IllegalArgumentException("dataInicio e dataFim são obrigatórios");
        }
        if (dataInicio.isAfter(dataFim)) {
            throw new IllegalArgumentException("dataInicio não pode ser posterior a dataFim");
        }
        ZoneId zone = ZoneId.systemDefault();
        OffsetDateTime inicio = dataInicio.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime fimExclusivo = dataFim.plusDays(1).atStartOfDay(zone).toOffsetDateTime();

        List<ComissaoLancamento> lancamentos = (vendedorId != null)
                ? lancamentoRepository.findByLojaIdAndVendedorIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
                        lojaId, vendedorId, inicio, fimExclusivo)
                : lancamentoRepository.findByLojaIdAndDataLancamentoGreaterThanEqualAndDataLancamentoLessThan(
                        lojaId, inicio, fimExclusivo);

        Map<UUID, ComissaoFechamentoResponse.ComissaoVendedorFechamento> porVendedor = new LinkedHashMap<>();
        List<ComissaoLancamento> validos = new ArrayList<>();
        BigDecimal totalBase = BigDecimal.ZERO;
        BigDecimal totalComissao = BigDecimal.ZERO;
        int quantidade = 0;

        for (ComissaoLancamento l : lancamentos) {
            if (l.getStatus() == ComissaoLancamento.StatusComissao.CANCELADO || !l.isAtivo()) continue;
            validos.add(l);
            ComissaoFechamentoResponse.ComissaoVendedorFechamento agg = porVendedor.computeIfAbsent(
                    l.getVendedorId(),
                    vid -> ComissaoFechamentoResponse.ComissaoVendedorFechamento.builder()
                            .vendedorId(vid)
                            .vendedorNome(l.getVendedorNome())
                            .quantidadeLancamentos(0)
                            .baseCalculo(BigDecimal.ZERO)
                            .valorComissao(BigDecimal.ZERO)
                            .build());
            agg.setQuantidadeLancamentos(agg.getQuantidadeLancamentos() + 1);
            agg.setBaseCalculo(agg.getBaseCalculo().add(l.getBaseCalculo()).setScale(2, RoundingMode.HALF_EVEN));
            agg.setValorComissao(agg.getValorComissao().add(l.getValorComissao()).setScale(2, RoundingMode.HALF_EVEN));
            totalBase = totalBase.add(l.getBaseCalculo()).setScale(2, RoundingMode.HALF_EVEN);
            totalComissao = totalComissao.add(l.getValorComissao()).setScale(2, RoundingMode.HALF_EVEN);
            quantidade++;
        }

        List<ComissaoFechamentoResponse.ComissaoVendedorFechamento> lista = porVendedor.values().stream()
                .sorted((a, b) -> {
                    String na = a.getVendedorNome() != null ? a.getVendedorNome() : "";
                    String nb = b.getVendedorNome() != null ? b.getVendedorNome() : "";
                    int c = na.compareToIgnoreCase(nb);
                    return c != 0 ? c : a.getVendedorId().toString().compareTo(b.getVendedorId().toString());
                })
                .toList();

        // Linhas por venda/lançamento, na ordem em que entraram no período — o agregado
        // acima é derivado desta mesma lista (mesmos filtros, totais batem).
        validos.sort(Comparator
                .comparing(ComissaoLancamento::getDataLancamento,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(l -> l.getVendedorNome() != null ? l.getVendedorNome() : "")
                .thenComparing(l -> l.getId() != null ? l.getId().toString() : ""));

        return ComissaoFechamentoResponse.builder()
                .dataInicio(dataInicio.toString())
                .dataFim(dataFim.toString())
                .quantidadeLancamentos(quantidade)
                .totalBase(totalBase)
                .totalComissao(totalComissao)
                .porVendedor(lista)
                .lancamentos(validos.stream().map(mapper::toLancamentoResponse).toList())
                .build();
    }
}
