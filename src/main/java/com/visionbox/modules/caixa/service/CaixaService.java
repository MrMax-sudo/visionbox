package com.visionbox.modules.caixa.service;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.*;
import com.visionbox.modules.caixa.repository.CaixaMovimentoRepository;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.ordemservico.domain.StatusOS;
import com.visionbox.modules.ordemservico.repository.OrdemServicoPagamentoRepository;
import com.visionbox.shared.error.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * CaixaService — sessão de caixa PDV: abertura com fundo de troco, movimentações
 * auditadas (sangria/suprimento com motivo obrigatório), fechamento com conferência
 * cega e relatório consolidado por modalidade (Fase 2 do Plano de Robustez ERP).
 *
 * Regras:
 * - R1: toda consulta escopada por lojaId (findByIdAndLojaId / queries com :lojaId).
 * - Fechamento cego: operador informa valor contado; sistema apura o valor do sistema
 *   (valorAbertura + entradas - saidas), grava a diferença (sobra/quebra) e a
 *   classificação. Nada de alíquota/taxa hard-coded; modalidades vêm do banco
 *   (forma_pagamento).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CaixaService {

    private static final String FORMA_DINHEIRO_FALLBACK = "DINHEIRO";

    private final CaixaSessaoRepository sessaoRepository;
    private final CaixaMovimentoRepository movimentoRepository;
    private final FormaPagamentoRepository formaPagamentoRepository;
    private final OrdemServicoPagamentoRepository pagamentoRepository;

    @Transactional(readOnly = true)
    public Optional<CaixaSessaoDTO> obterSessaoAtual(UUID lojaId) {
        return sessaoRepository.findSessaoAbertaAtual(lojaId)
                .map(this::toDTO);
    }

    @Transactional
    public CaixaSessaoDTO abrirCaixa(UUID lojaId, UUID usuarioId, AbrirCaixaRequest req) {
        Optional<CaixaSessao> existente = sessaoRepository.findSessaoAbertaAtual(lojaId);
        if (existente.isPresent()) {
            throw new BusinessException("Já existe uma sessão de caixa aberta para esta loja. Feche-a antes de abrir uma nova.");
        }

        BigDecimal saldoInicial = req.saldoInicial() != null ? req.saldoInicial().setScale(2, RoundingMode.HALF_EVEN) : BigDecimal.ZERO;

        CaixaSessao sessao = CaixaSessao.builder()
                .lojaId(lojaId)
                .usuarioId(usuarioId)
                .operadorNome(req.operadorNome() != null ? req.operadorNome() : "Operador")
                .identificacaoCaixa(req.identificacaoCaixa() != null && !req.identificacaoCaixa().isBlank() ? req.identificacaoCaixa() : "CAIXA_01")
                .status(CaixaSessao.StatusCaixa.ABERTO)
                .abertoEm(OffsetDateTime.now())
                .saldoInicial(saldoInicial)
                .totalEntradas(BigDecimal.ZERO)
                .totalSaidas(BigDecimal.ZERO)
                .saldoEsperado(saldoInicial)
                .build();

        sessao = sessaoRepository.save(sessao);

        if (saldoInicial.compareTo(BigDecimal.ZERO) > 0) {
            CaixaMovimento movAbertura = CaixaMovimento.builder()
                    .lojaId(lojaId)
                    .sessao(sessao)
                    .tipo(CaixaMovimento.TipoMovimento.ABERTURA)
                    .valor(saldoInicial)
                    .formaPagamento(resolverFormaDinheiro(lojaId))
                    .motivo("Fundo de troco inicial")
                    .usuarioNome(sessao.getOperadorNome())
                    .criadoEm(OffsetDateTime.now())
                    .build();
            movimentoRepository.save(movAbertura);
            sessao.getMovimentos().add(movAbertura);
        }

        log.info("Caixa aberto com sucesso lojaId={} sessaoId={} saldoInicial={}", lojaId, sessao.getId(), saldoInicial);
        return toDTO(sessao);
    }

    @Transactional
    public CaixaSessaoDTO movimentar(UUID lojaId, MovimentarCaixaRequest req) {
        CaixaSessao sessao = sessaoRepository.findSessaoAbertaAtual(lojaId)
                .orElseThrow(() -> new BusinessException("Não há caixa aberto no momento para realizar movimentações."));

        BigDecimal valor = req.valor().setScale(2, RoundingMode.HALF_EVEN);

        if (req.tipo() == CaixaMovimento.TipoMovimento.SANGRIA) {
            if (valor.compareTo(sessao.getSaldoEsperado()) > 0) {
                throw new BusinessException("Valor da sangria excede o saldo disponível em caixa.");
            }
            sessao.setTotalSaidas(sessao.getTotalSaidas().add(valor));
            sessao.setSaldoEsperado(sessao.getSaldoEsperado().subtract(valor));
        } else if (req.tipo() == CaixaMovimento.TipoMovimento.SUPRIMENTO || req.tipo() == CaixaMovimento.TipoMovimento.VENDA_DINHEIRO) {
            sessao.setTotalEntradas(sessao.getTotalEntradas().add(valor));
            sessao.setSaldoEsperado(sessao.getSaldoEsperado().add(valor));
        } else if (req.tipo() == CaixaMovimento.TipoMovimento.VENDA_OUTROS) {
            sessao.setTotalEntradas(sessao.getTotalEntradas().add(valor));
        } else if (req.tipo() == CaixaMovimento.TipoMovimento.ENTRADA) {
            // Baixa de título em dinheiro (ContaReceberService) — entra fisicamente na gaveta:
            // sem este branch o fechamento cego apuraria QUEBRA falsa (D-019).
            sessao.setTotalEntradas(sessao.getTotalEntradas().add(valor));
            sessao.setSaldoEsperado(sessao.getSaldoEsperado().add(valor));
        } else if (req.tipo() == CaixaMovimento.TipoMovimento.RECEBIMENTO_FIADO) {
            // Baixa de título em cartão/PIX/crediário — entrada do turno, sem efeito na gaveta
            // (mesma semântica do VENDA_OUTROS). O dinheiro nunca passou pelo caixa físico.
            sessao.setTotalEntradas(sessao.getTotalEntradas().add(valor));
        } else if (req.tipo() == CaixaMovimento.TipoMovimento.ESTORNO) {
            // Estorno simétrico à baixa original: dinheiro volta ao cliente (gaveta perde);
            // forma não-dinheiro é saída "de papel" do turno, sem tocar a gaveta (D-019).
            if (isFormaDinheiro(req.formaPagamento())) {
                sessao.setTotalSaidas(sessao.getTotalSaidas().add(valor));
                sessao.setSaldoEsperado(sessao.getSaldoEsperado().subtract(valor));
            } else {
                sessao.setTotalSaidas(sessao.getTotalSaidas().add(valor));
            }
        }

        CaixaMovimento mov = CaixaMovimento.builder()
                .lojaId(lojaId)
                .sessao(sessao)
                .tipo(req.tipo())
                .valor(valor)
                .formaPagamento(req.formaPagamento() != null ? req.formaPagamento() : FORMA_DINHEIRO_FALLBACK)
                .motivo(req.motivo())
                .usuarioNome(req.usuarioNome())
                .criadoEm(OffsetDateTime.now())
                .build();

        movimentoRepository.save(mov);
        sessao.getMovimentos().add(mov);
        sessaoRepository.save(sessao);

        return toDTO(sessao);
    }

    /**
     * Sangria (retirada de gaveta) — motivo e valor obrigatórios (auditoria).
     * Idempotência: o {@code IdempotencyFilter} global cobre POSTs com header
     * {@code Idempotency-Key} (R4), incluindo este endpoint.
     */
    @Transactional
    public CaixaSessaoDTO sangria(UUID lojaId, SangriaSuprimentoRequest req) {
        validarValorEMotivo(req, "sangria");
        String forma = req.formaPagamento() != null && !req.formaPagamento().isBlank()
                ? req.formaPagamento()
                : resolverFormaDinheiro(lojaId);
        return movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.SANGRIA, req.valor(), forma, req.motivo(), req.usuarioNome()));
    }

    /**
     * Suprimento (aporte de gaveta) — motivo e valor obrigatórios (auditoria).
     * Mesma cobertura de idempotência da sangria via header {@code Idempotency-Key} (R4).
     */
    @Transactional
    public CaixaSessaoDTO suprimento(UUID lojaId, SangriaSuprimentoRequest req) {
        validarValorEMotivo(req, "suprimento");
        String forma = req.formaPagamento() != null && !req.formaPagamento().isBlank()
                ? req.formaPagamento()
                : resolverFormaDinheiro(lojaId);
        return movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.SUPRIMENTO, req.valor(), forma, req.motivo(), req.usuarioNome()));
    }

    @Transactional
    public CaixaSessaoDTO fecharCaixa(UUID lojaId, FecharCaixaRequest req) {
        CaixaSessao sessao = sessaoRepository.findSessaoAbertaAtual(lojaId)
                .orElseThrow(() -> new BusinessException("Nenhum caixa aberto para fechamento."));

        BigDecimal informado = req.saldoInformado().setScale(2, RoundingMode.HALF_EVEN);
        BigDecimal esperado = sessao.getSaldoEsperado();
        BigDecimal diferenca = informado.subtract(esperado);

        sessao.setStatus(CaixaSessao.StatusCaixa.FECHADO);
        sessao.setFechadoEm(OffsetDateTime.now());
        sessao.setSaldoInformadoFechamento(informado);
        sessao.setValorFechamentoSistema(esperado);
        sessao.setDiferencaFechamento(diferenca);
        sessao.setObservacaoFechamento(req.observacao());

        String classificacao = classificarDiferenca(diferenca);
        CaixaMovimento movFechamento = CaixaMovimento.builder()
                .lojaId(lojaId)
                .sessao(sessao)
                .tipo(CaixaMovimento.TipoMovimento.FECHAMENTO)
                .valor(informado)
                .formaPagamento("CONFERENCIA")
                .motivo("Fechamento (" + classificacao + ") com saldo informado R$ " + informado + " (diferença: R$ " + diferenca + ")")
                .usuarioNome(sessao.getOperadorNome())
                .criadoEm(OffsetDateTime.now())
                .build();

        movimentoRepository.save(movFechamento);
        sessao.getMovimentos().add(movFechamento);
        sessao = sessaoRepository.save(sessao);

        log.info("Caixa fechado com sucesso lojaId={} sessaoId={} esperado={} informado={} diferenca={} classificacao={}",
                lojaId, sessao.getId(), esperado, informado, diferenca, classificacao);

        return toDTO(sessao);
    }

    @Transactional(readOnly = true)
    public Page<CaixaSessaoDTO> listarHistorico(UUID lojaId, Pageable pageable) {
        return sessaoRepository.findByLojaIdOrderByAbertoEmDesc(lojaId, pageable)
                .map(this::toDTO);
    }

    /** Histórico de turnos por operador e/ou período (Fase 2). */
    @Transactional(readOnly = true)
    public Page<CaixaSessaoDTO> listarHistorico(UUID lojaId, UUID usuarioId,
                                                 OffsetDateTime inicio, OffsetDateTime fim,
                                                 Pageable pageable) {
        return sessaoRepository.buscarHistorico(lojaId, usuarioId, inicio, fim, pageable)
                .map(this::toDTO);
    }

    /** Extrato paginado do turno, com filtro opcional por tipo de movimento. */
    @Transactional(readOnly = true)
    public Page<CaixaMovimentoDTO> extrato(UUID lojaId, UUID sessaoId,
                                            CaixaMovimento.TipoMovimento tipo,
                                            Pageable pageable) {
        validarSessaoDaLoja(lojaId, sessaoId);
        Page<CaixaMovimento> pagina = (tipo != null)
                ? movimentoRepository.findBySessaoIdAndLojaIdAndTipo(sessaoId, lojaId, tipo, pageable)
                : movimentoRepository.findBySessaoIdAndLojaId(sessaoId, lojaId, pageable);
        return pagina.map(this::toMovimentoDTO);
    }

    /**
     * Relatório consolidado de fechamento do turno — JSON para impressão térmica 80mm.
     * Resumo por modalidade montado a partir das formas de pagamento cadastradas na loja
     * (banco), somando os pagamentos das vendas no período do turno (OS canceladas
     * excluídas). Funciona para turno aberto (informado/diferença nulos) e fechado.
     */
    @Transactional(readOnly = true)
    public RelatorioFechamentoDTO relatorioFechamento(UUID lojaId, UUID sessaoId) {
        CaixaSessao sessao = sessaoRepository.findByIdAndLojaId(sessaoId, lojaId)
                .orElseThrow(() -> new BusinessException("Sessão de caixa não encontrada para esta loja."));

        List<CaixaMovimento> movimentos =
                movimentoRepository.findBySessaoIdAndLojaIdOrderByCriadoEmAsc(sessaoId, lojaId);

        BigDecimal totalSangrias = somarPorTipo(movimentos, CaixaMovimento.TipoMovimento.SANGRIA);
        BigDecimal totalSuprimentos = somarPorTipo(movimentos, CaixaMovimento.TipoMovimento.SUPRIMENTO);

        OffsetDateTime fimJanela = sessao.getFechadoEm() != null ? sessao.getFechadoEm() : OffsetDateTime.now();
        Map<UUID, BigDecimal> totaisPorForma = somarPagamentosDoTurno(lojaId, sessao.getAbertoEm(), fimJanela);

        // Total de vendas = soma dos pagamentos por modalidade no período do turno
        // (vendas não necessariamente geram CaixaMovimento; a fonte é ordem_servico_pagamento).
        BigDecimal totalVendas = totaisPorForma.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<FormaPagamento> formasAtivas = formaPagamentoRepository.findByLojaIdAndAtivoTrue(lojaId);
        List<ResumoModalidadeDTO> resumoPorModalidade = formasAtivas.stream()
                .map(f -> new ResumoModalidadeDTO(
                        f.getId(),
                        f.getNome() != null ? f.getNome() : f.getTipo().name(),
                        totaisPorForma.getOrDefault(f.getId(), BigDecimal.ZERO).setScale(2, RoundingMode.HALF_EVEN)))
                .collect(Collectors.toCollection(java.util.ArrayList::new));

        // Pagamentos de formas desativadas/removidas após o turno: não somem do relatório.
        Map<UUID, String> formasConhecidas = formasAtivas.stream()
                .collect(Collectors.toMap(FormaPagamento::getId,
                        f -> f.getNome() != null ? f.getNome() : f.getTipo().name(),
                        (a, b) -> a, LinkedHashMap::new));
        totaisPorForma.forEach((formaId, total) -> {
            if (!formasConhecidas.containsKey(formaId)) {
                resumoPorModalidade.add(new ResumoModalidadeDTO(formaId, "Forma não cadastrada", total.setScale(2, RoundingMode.HALF_EVEN)));
            }
        });

        BigDecimal valorSistema = sessao.getValorFechamentoSistema() != null
                ? sessao.getValorFechamentoSistema()
                : sessao.getSaldoEsperado();

        return new RelatorioFechamentoDTO(
                sessao.getId(),
                sessao.getIdentificacaoCaixa(),
                sessao.getOperadorNome(),
                sessao.getStatus(),
                sessao.getAbertoEm(),
                sessao.getFechadoEm(),
                sessao.getSaldoInicial(),
                sessao.getTotalEntradas(),
                sessao.getTotalSaidas(),
                valorSistema,
                sessao.getSaldoInformadoFechamento(),
                sessao.getDiferencaFechamento(),
                sessao.getDiferencaFechamento() != null
                        ? classificarDiferenca(sessao.getDiferencaFechamento())
                        : null,
                sessao.getObservacaoFechamento(),
                totalVendas.setScale(2, RoundingMode.HALF_EVEN),
                totalSangrias.setScale(2, RoundingMode.HALF_EVEN),
                totalSuprimentos.setScale(2, RoundingMode.HALF_EVEN),
                resumoPorModalidade,
                movimentos.stream().map(this::toMovimentoDTO).collect(Collectors.toList()));
    }

    // ---------------------------------------------------------------- privados

    private void validarSessaoDaLoja(UUID lojaId, UUID sessaoId) {
        sessaoRepository.findByIdAndLojaId(sessaoId, lojaId)
                .orElseThrow(() -> new BusinessException("Sessão de caixa não encontrada para esta loja."));
    }

    private void validarValorEMotivo(SangriaSuprimentoRequest req, String rotulo) {
        if (req.valor() == null || req.valor().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Valor da " + rotulo + " deve ser maior que zero.");
        }
        if (req.motivo() == null || req.motivo().isBlank()) {
            throw new BusinessException("Motivo da " + rotulo + " é obrigatório para auditoria de gaveta.");
        }
    }

    /** SOBRA (diferença positiva), QUEBRA (negativa) ou EXATO (zerada). */
    private String classificarDiferenca(BigDecimal diferenca) {
        int cmp = diferenca.compareTo(BigDecimal.ZERO);
        return cmp > 0 ? "SOBRA" : (cmp < 0 ? "QUEBRA" : "EXATO");
    }

    /** Forma de pagamento do movimento é "dinheiro" (string do TipoFormaPagamento)? */
    private boolean isFormaDinheiro(String forma) {
        return forma == null || forma.isBlank() || FormaPagamento.TipoFormaPagamento.DINHEIRO.name().equals(forma);
    }

    private BigDecimal somarPorTipo(List<CaixaMovimento> movimentos, CaixaMovimento.TipoMovimento tipo) {
        return movimentos.stream()
                .filter(m -> m.getTipo() == tipo && m.getValor() != null)
                .map(CaixaMovimento::getValor)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Totais de pagamentos por forma no período do turno, excluindo OS canceladas.
     * Usa o snapshot forma_pagamento_nome da linha de pagamento quando disponível.
     */
    private Map<UUID, BigDecimal> somarPagamentosDoTurno(UUID lojaId, OffsetDateTime inicio, OffsetDateTime fim) {
        Map<UUID, BigDecimal> totais = new LinkedHashMap<>();
        try {
            List<Object[]> linhas = pagamentoRepository.somarPorFormaPagamentoNoPeriodo(
                    lojaId, inicio, fim, StatusOS.CANCELADO);
            for (Object[] linha : linhas) {
                UUID formaId = (UUID) linha[0];
                BigDecimal total = toBigDecimal(linha[2]);
                if (formaId != null && total != null) {
                    totais.merge(formaId, total, BigDecimal::add);
                }
            }
        } catch (Exception e) {
            // Relatório não pode quebrar o fechamento por falha de agregação — loga e segue sem vendas por modalidade.
            log.warn("Falha ao apurar pagamentos do turno lojaId={} periodo=[{}, {}]: {}",
                    lojaId, inicio, fim, e.getMessage());
        }
        return totais;
    }

    private BigDecimal toBigDecimal(Object valor) {
        if (valor == null) return null;
        if (valor instanceof BigDecimal bd) return bd;
        if (valor instanceof Number n) return new BigDecimal(n.toString());
        return null;
    }

    /**
     * Nome da forma "dinheiro" da loja vindo do banco (forma_pagamento), com fallback
     * literal para compatibilidade com lojas sem cadastro. Nenhuma modalidade nova
     * é inventada em código (R3/alcance do Plano de Robustez).
     */
    private String resolverFormaDinheiro(UUID lojaId) {
        try {
            return formaPagamentoRepository.findByLojaIdAndAtivoTrue(lojaId).stream()
                    .filter(f -> f.getTipo() == FormaPagamento.TipoFormaPagamento.DINHEIRO)
                    .map(FormaPagamento::getNome)
                    .findFirst()
                    .orElse(FORMA_DINHEIRO_FALLBACK);
        } catch (Exception e) {
            log.warn("Não foi possível resolver forma de pagamento dinheiro para loja {}: {}", lojaId, e.getMessage());
            return FORMA_DINHEIRO_FALLBACK;
        }
    }

    private CaixaMovimentoDTO toMovimentoDTO(CaixaMovimento m) {
        return new CaixaMovimentoDTO(
                m.getId(),
                m.getTipo(),
                m.getValor(),
                m.getFormaPagamento(),
                m.getMotivo(),
                m.getUsuarioNome(),
                m.getCriadoEm()
        );
    }

    private CaixaSessaoDTO toDTO(CaixaSessao s) {
        List<CaixaMovimentoDTO> movs = s.getMovimentos() != null
                ? s.getMovimentos().stream().map(this::toMovimentoDTO).collect(Collectors.toList())
                : List.of();

        return new CaixaSessaoDTO(
                s.getId(),
                s.getLojaId(),
                s.getUsuarioId(),
                s.getOperadorNome(),
                s.getIdentificacaoCaixa(),
                s.getStatus(),
                s.getAbertoEm(),
                s.getFechadoEm(),
                s.getSaldoInicial(),
                s.getTotalEntradas(),
                s.getTotalSaidas(),
                s.getSaldoEsperado(),
                s.getSaldoInformadoFechamento(),
                s.getValorFechamentoSistema(),
                s.getDiferencaFechamento(),
                s.getDiferencaFechamento() != null ? classificarDiferenca(s.getDiferencaFechamento()) : null,
                s.getObservacaoFechamento(),
                movs
        );
    }
}
