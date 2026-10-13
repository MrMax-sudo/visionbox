package com.visionbox.modules.financeiro.service;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.MovimentarCaixaRequest;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
import com.visionbox.modules.caixa.service.CaixaService;
import com.visionbox.modules.financeiro.domain.ContaReceber;
import com.visionbox.modules.financeiro.domain.ContaReceberPagamento;
import com.visionbox.modules.financeiro.dto.BaixaContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberPagamentoResponse;
import com.visionbox.modules.financeiro.dto.ContaReceberRequest;
import com.visionbox.modules.financeiro.dto.ContaReceberResponse;
import com.visionbox.modules.financeiro.formapagamento.domain.FormaPagamento;
import com.visionbox.modules.financeiro.formapagamento.repository.FormaPagamentoRepository;
import com.visionbox.modules.financeiro.mapper.ContaReceberMapper;
import com.visionbox.modules.financeiro.repository.ContaReceberPagamentoRepository;
import com.visionbox.modules.financeiro.repository.ContaReceberRepository;
import com.visionbox.shared.error.BusinessException;
import com.visionbox.shared.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContaReceberService {

    private final ContaReceberRepository repository;
    private final ContaReceberMapper mapper;
    private final ContaReceberPagamentoRepository pagamentoRepository;
    private final FormaPagamentoRepository formaPagamentoRepository;
    private final CaixaSessaoRepository caixaSessaoRepository;
    private final CaixaService caixaService;

    @Transactional
    public ContaReceberResponse gerar(ContaReceberRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        BigDecimal valor = req.getValor().setScale(2, RoundingMode.HALF_EVEN);
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("valor deve ser > 0");
        }
        LocalDate venc = LocalDate.parse(req.getVencimento());
        if (venc == null) throw new IllegalArgumentException("vencimento obrigatório");

        ContaReceber entity = ContaReceber.builder()
                .lojaId(lojaId)
                .clienteId(req.getClienteId())
                .pedidoId(req.getPedidoId())
                .ordemServicoId(req.getOrdemServicoId())
                .valor(valor)
                .valorPago(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN))
                .vencimento(venc)
                .descricao(req.getDescricao())
                .numeroDocumento(req.getNumeroDocumento())
                .parcela(req.getParcela())
                .totalParcelas(req.getTotalParcelas())
                .status(ContaReceber.StatusConta.PENDENTE)
                .build();
        entity.normalizarValor();
        entity = repository.save(entity);
        log.info("ContaReceber gerada loja={} id={} cliente={} valor={} venc={}", lojaId, entity.getId(), req.getClienteId(), valor, venc);
        return mapper.toResponse(entity);
    }

    /**
     * Atalho usado ao fechar PDV/OS — cria conta com vencimento hoje + parcelamento simples.
     */
    @Transactional
    public ContaReceber gerarAoFechar(UUID clienteId, UUID pedidoId, UUID ordemServicoId, BigDecimal valorTotal, LocalDate vencimento, String descricao) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        BigDecimal valor = valorTotal.setScale(2, RoundingMode.HALF_EVEN);
        LocalDate venc = vencimento != null ? vencimento : LocalDate.now();
        ContaReceber entity = ContaReceber.builder()
                .lojaId(lojaId)
                .clienteId(clienteId)
                .pedidoId(pedidoId)
                .ordemServicoId(ordemServicoId)
                .valor(valor)
                .valorPago(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN))
                .vencimento(venc)
                .descricao(descricao != null ? descricao : "Venda PDV/OS " + (pedidoId != null ? pedidoId : ordemServicoId))
                .status(ContaReceber.StatusConta.PENDENTE)
                .build();
        entity.normalizarValor();
        entity = repository.save(entity);
        log.info("ContaReceber fechar PDV/OS loja={} cliente={} valor={} venc={}", lojaId, clienteId, valor, venc);
        return entity;
    }

    @Transactional(readOnly = true)
    public Page<ContaReceberResponse> listar(String status, Pageable pageable) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        Page<ContaReceber> page;
        if (status != null && !status.isBlank()) {
            ContaReceber.StatusConta st = ContaReceber.StatusConta.valueOf(status.trim().toUpperCase());
            page = repository.findByLojaIdAndStatus(lojaId, st, pageable);
        } else {
            page = repository.findAllByLojaId(lojaId, pageable);
        }
        return page.map(mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public ContaReceberResponse buscar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        return mapper.toResponse(e);
    }

    /** Atalho de baixa sem desconto/juros (compat — usado por conciliação OFX e testes). */
    @Transactional
    public ContaReceberResponse baixar(UUID id, BigDecimal valorPago) {
        return baixar(id, BaixaContaReceberRequest.builder().valorPago(valorPago).build());
    }

    /**
     * Baixa (parcial ou total) — Fase 3 Robustez §3.3 + V41 desconto/juros (D-021).
     * <p>
     * Regras: valor informado deve ser > 0 e {@code valorPago + desconto <= valor em aberto}
     * (saldo). Toda baixa grava linha em {@code conta_receber_pagamento} (histórico) e
     * debita o saldo em aberto. Saldo zerado → status PAGO; caso contrário → PARCIAL.
     * Se houver caixa aberto, lança CaixaMovimento (ENTRADA p/ dinheiro, RECEBIMENTO_FIADO
     * demais). Idempotência (R4): via header Idempotency-Key — coberto pelo IdempotencyFilter global.
     * <p>
     * Semântica desconto/juros (V41, D-021 — exata):
     * <ul>
     *   <li>{@code desconto}: quita parte do título SEM dinheiro entrar. O valor efetivamente
     *       abatido do {@code valor_aberto} é {@code valorPago + desconto}; logo o
     *       {@code valor_pago} agregado da conta (fonte da coluna GENERATED valor_aberto)
     *       soma {@code valorPago + desconto}. Ex.: saldo 100, pago 90 + desconto 10 →
     *       valor_pago=100, valor_aberto=0, status PAGO.</li>
     *   <li>{@code juros}: NÃO altera valor_aberto — é receita extra paga pelo cliente
     *       (mora/multa). Entra no caixa somada ao valorPago (movimento = valorPago + juros).</li>
     *   <li>Desconto/juros > 0 são registrados na observação da linha de histórico.</li>
     * </ul>
     */
    @Transactional
    public ContaReceberResponse baixar(UUID id, BaixaContaReceberRequest req) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        if (e.getStatus() == ContaReceber.StatusConta.CANCELADO) {
            throw new IllegalStateException("Conta cancelada não pode ser baixada");
        }
        if (e.getStatus() == ContaReceber.StatusConta.PAGO) {
            throw new IllegalStateException("Conta já está totalmente paga");
        }
        BigDecimal saldoAberto = e.getSaldo();
        BigDecimal desconto = req.getDesconto() != null
                ? req.getDesconto().setScale(2, RoundingMode.HALF_EVEN) : BigDecimal.ZERO;
        BigDecimal juros = req.getJuros() != null
                ? req.getJuros().setScale(2, RoundingMode.HALF_EVEN) : BigDecimal.ZERO;
        if (desconto.signum() < 0) {
            throw new IllegalArgumentException("desconto não pode ser negativo");
        }
        if (juros.signum() < 0) {
            throw new IllegalArgumentException("juros não pode ser negativo");
        }
        BigDecimal pago = req.getValorPago() != null
                ? req.getValorPago().setScale(2, RoundingMode.HALF_EVEN)
                : saldoAberto;
        if (pago.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("valor pago deve ser maior que zero");
        }
        // D-021: o que quita o título é valorPago + desconto — validado contra o saldo em aberto.
        BigDecimal abatido = pago.add(desconto).setScale(2, RoundingMode.HALF_EVEN);
        if (abatido.compareTo(saldoAberto) > 0) {
            throw new IllegalArgumentException("valor pago + desconto (" + abatido
                    + ") excede o valor em aberto. aberto=" + saldoAberto);
        }

        FormaPagamento forma = null;
        if (req.getFormaPagamentoId() != null) {
            forma = formaPagamentoRepository.findByIdAndLojaId(req.getFormaPagamentoId(), lojaId)
                    .orElseThrow(() -> new EntityNotFoundException("Forma de pagamento não encontrada"));
        }

        BigDecimal novoPago = e.getValorPago().add(abatido).setScale(2, RoundingMode.HALF_EVEN);
        OffsetDateTime dataPagamento = OffsetDateTime.now();
        e.setValorPago(novoPago);
        if (novoPago.compareTo(e.getValor()) == 0) {
            e.setStatus(ContaReceber.StatusConta.PAGO);
            e.setDataPagamento(dataPagamento);
        } else {
            e.setStatus(ContaReceber.StatusConta.PARCIAL);
        }
        e = repository.save(e);

        // D-021: no caixa entra DINHEIRO — valorPago + juros. Desconto não entra (nada foi recebido).
        String observacaoBaixa = comporObservacaoBaixa(req.getObservacao(), desconto, juros);
        UUID caixaId = lancarMovimentoCaixa(lojaId, e, pago.add(juros).setScale(2, RoundingMode.HALF_EVEN),
                forma, observacaoBaixa);

        ContaReceberPagamento pagamento = ContaReceberPagamento.builder()
                .lojaId(lojaId)
                .contaReceberId(e.getId())
                .caixaId(caixaId)
                .usuarioId(currentUsuarioId())
                .formaPagamentoId(forma != null ? forma.getId() : null)
                .valorPago(pago)
                .valorDesconto(desconto)
                .valorJuros(juros)
                .dataPagamento(dataPagamento)
                .observacao(observacaoBaixa)
                .build();
        pagamentoRepository.save(pagamento);

        log.info("ContaReceber baixa loja={} id={} pago={} desconto={} juros={} saldo={} status={} caixa={}",
                lojaId, id, pago, desconto, juros, e.getSaldo(), e.getStatus(), caixaId);
        return mapper.toResponse(e);
    }

    /**
     * Anexa desconto/juros à observação da baixa quando > 0 (rastro legível na linha de
     * histórico e no motivo do movimento de caixa). Trunca em 255 (limite da coluna).
     */
    private String comporObservacaoBaixa(String observacao, BigDecimal desconto, BigDecimal juros) {
        StringBuilder sb = new StringBuilder(observacao != null ? observacao : "");
        if (desconto.signum() > 0) {
            if (sb.length() > 0) sb.append(" | ");
            sb.append("desconto R$ ").append(desconto);
        }
        if (juros.signum() > 0) {
            if (sb.length() > 0) sb.append(" | ");
            sb.append("juros R$ ").append(juros);
        }
        String texto = sb.toString();
        return texto.length() > 255 ? texto.substring(0, 255) : texto;
    }

    /**
     * Histórico de baixas da conta (§3.3) — timeline para o modal de detalhes.
     */
    @Transactional(readOnly = true)
    public List<ContaReceberPagamentoResponse> listarPagamentos(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        return pagamentoRepository.findByLojaIdAndContaReceberIdOrderByDataPagamentoAsc(lojaId, id)
                .stream().map(this::toPagamentoResponse).toList();
    }

    /**
     * Estorno de baixa (§3.3 — pendência D-012): reabre o título removendo UMA linha
     * do histórico de pagamentos. Efeitos ATÔMICOS na mesma transação:
     * <ol>
     *   <li>{@code conta_receber_pagamento} sofre SOFT-DELETE ({@code ativo=false}) — a linha é
     *       evidência financeira (operador, caixa, forma) e some da timeline pelo
     *       {@code @SQLRestriction}; DELETE físico destruiria o rastro da baixa que
     *       permanece nos movimentos do turno (decisão D-017).</li>
     *   <li>{@code valor_pago} da conta é reduzido — simetria com a baixa (D-021/V41):
     *       o que abateu o título foi {@code valorPago + desconto}, então é isto que volta.
     *       {@code valor_aberto} é GENERATED (valor - valor_pago), logo o recálculo é
     *       automático no banco.</li>
     *   <li>Status: saldo restante zero → PENDENTE (≡ ABERTO, D-012); senão → PARCIAL.
     *       {@code data_pagamento} volta a nulo (título não quitado).</li>
     *   <li>Se houver caixa aberto, lança {@code CaixaMovimento ESTORNO} com
     *       {@code valorPago + juros} — o dinheiro que tinha entrado na gaveta/banco
     *       (V23/V34 já contemplam o tipo no CHECK e no enum). Sem caixa aberto: estorno
     *       prossegue + WARN — mesmo padrão da baixa, o balcão nunca trava.</li>
     * </ol>
     * Regras: conta CANCELADA não aceita estorno; pagamento de outra loja/conta → 404 (R1);
     * pagamento já estornado fica invisível pelo {@code @SQLRestriction} → 404 (replay
     * duplo sem Idempotency-Key não estorna duas vezes). Auditoria: log INFO com quem
     * estornou + movimento ESTORNO com operador/motivo.
     */
    @Transactional
    public ContaReceberResponse estornarPagamento(UUID id, UUID pagamentoId, String observacao) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber conta = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        if (conta.getStatus() == ContaReceber.StatusConta.CANCELADO) {
            throw new BusinessException("Conta cancelada não aceita estorno de baixa");
        }
        ContaReceberPagamento pagamento = pagamentoRepository
                .findByIdAndLojaIdAndContaReceberId(pagamentoId, lojaId, id)
                .orElseThrow(() -> new EntityNotFoundException("Pagamento não encontrado para esta conta"));

        BigDecimal valorEstorno = pagamento.getValorPago()
                .add(nvl(pagamento.getValorDesconto())).setScale(2, RoundingMode.HALF_EVEN);
        BigDecimal novoPago = conta.getValorPago().subtract(valorEstorno).setScale(2, RoundingMode.HALF_EVEN);
        if (novoPago.signum() < 0) {
            // Invariante violada (edição manual de base): falha alto — clamp esconderia o bug.
            throw new BusinessException("Estorno inconsistente: valor pago da baixa excede o total pago da conta");
        }

        conta.setValorPago(novoPago);
        if (novoPago.signum() == 0) {
            conta.setStatus(ContaReceber.StatusConta.PENDENTE);
        } else {
            conta.setStatus(ContaReceber.StatusConta.PARCIAL);
        }
        conta.setDataPagamento(null);
        repository.save(conta);

        pagamento.setAtivo(false);
        pagamentoRepository.save(pagamento);

        UUID caixaId = lancarMovimentoEstornoCaixa(lojaId, conta, pagamento, observacao);

        log.info("ContaReceber estorno de baixa loja={} conta={} pagamento={} valor={} (pago={} desconto={}) juros={} novoSaldo={} status={} caixa={} operador={}",
                lojaId, id, pagamentoId, valorEstorno, pagamento.getValorPago(), pagamento.getValorDesconto(),
                pagamento.getValorJuros(), conta.getSaldo(), conta.getStatus(), caixaId, currentUsuarioNome());
        return mapper.toResponse(conta);
    }

    /** V41 — linhas antigas podem ter valor_desconto/valor_juros nulos; trata como zero. */
    private static BigDecimal nvl(BigDecimal valor) {
        return valor != null ? valor : BigDecimal.ZERO;
    }

    /**
     * Lança movimento no caixa aberto, se houver. Sem caixa aberto: segue a baixa
     * (caixa_id nulo no histórico) e registra WARN — a baixa não pode travar o balcão.
     */
    private UUID lancarMovimentoCaixa(UUID lojaId, ContaReceber conta, BigDecimal valor,
                                      FormaPagamento forma, String observacao) {
        Optional<CaixaSessao> aberto = caixaSessaoRepository.findSessaoAbertaAtual(lojaId);
        if (aberto.isEmpty()) {
            log.warn("Baixa de conta a receber sem caixa aberto loja={} conta={} valor={} — movimento não lançado",
                    lojaId, conta.getId(), valor);
            return null;
        }
        boolean dinheiro = forma == null || forma.getTipo() == FormaPagamento.TipoFormaPagamento.DINHEIRO;
        CaixaMovimento.TipoMovimento tipo = dinheiro
                ? CaixaMovimento.TipoMovimento.ENTRADA
                : CaixaMovimento.TipoMovimento.RECEBIMENTO_FIADO;
        String motivo = ("Baixa conta a receber: " + (conta.getDescricao() != null ? conta.getDescricao() : conta.getId()))
                + (observacao != null ? " | " + observacao : "");
        caixaService.movimentar(lojaId, new MovimentarCaixaRequest(
                tipo,
                valor,
                forma != null ? forma.getTipo().name() : FormaPagamento.TipoFormaPagamento.DINHEIRO.name(),
                motivo.length() > 255 ? motivo.substring(0, 255) : motivo,
                null
        ));
        return aberto.get().getId();
    }

    /**
     * Identidade do operador para auditoria do histórico — mesmo critério do
     * CaixaController: UUID determinístico do username do JWT.
     */
    private UUID currentUsuarioId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
            return UUID.nameUUIDFromBytes(auth.getName().getBytes(StandardCharsets.UTF_8));
        }
        return null;
    }

    /** Username do JWT para o movimento de caixa do estorno (auditoria de quem estornou). */
    private String currentUsuarioNome() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : null;
    }

    /**
     * Lança movimento ESTORNO no caixa ABERTO atual (o turno original pode já estar
     * fechado — o estorno financeiro é do turno corrente). Sem caixa aberto: estorno
     * prossegue e registra WARN — mesmo contrato da baixa, o balcão nunca trava.
     * Simetria da baixa em {@code CaixaService.movimentar} (D-019): ENTRADA soma a
     * gaveta; ESTORNO de baixa em dinheiro subtrai da gaveta, e de forma não-dinheiro
     * é apenas saída de papel do turno (sem tocar o saldo esperado).
     * D-021/V41: o valor estornado é {@code valorPago + juros} — exatamente o dinheiro
     * que a baixa tinha colocado no caixa (juros entrou junto; desconto nunca entrou).
     */
    private UUID lancarMovimentoEstornoCaixa(UUID lojaId, ContaReceber conta,
                                            ContaReceberPagamento pagamento, String observacao) {
        Optional<CaixaSessao> aberto = caixaSessaoRepository.findSessaoAbertaAtual(lojaId);
        if (aberto.isEmpty()) {
            log.warn("Estorno de baixa sem caixa aberto loja={} conta={} pagamento={} valor={} — movimento não lançado",
                    lojaId, conta.getId(), pagamento.getId(), pagamento.getValorPago());
            return null;
        }
        String forma = pagamento.getFormaPagamentoId() != null
                ? formaPagamentoRepository.findByIdAndLojaId(pagamento.getFormaPagamentoId(), lojaId)
                        .map(f -> f.getTipo().name())
                        .orElse(FormaPagamento.TipoFormaPagamento.DINHEIRO.name())
                : FormaPagamento.TipoFormaPagamento.DINHEIRO.name();
        String motivo = ("Estorno de baixa: " + (conta.getDescricao() != null ? conta.getDescricao() : conta.getId()))
                + (observacao != null && !observacao.isBlank() ? " | " + observacao : "");
        BigDecimal valorEstornoCaixa = pagamento.getValorPago()
                .add(pagamento.getValorJuros() != null ? pagamento.getValorJuros() : BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_EVEN);
        caixaService.movimentar(lojaId, new MovimentarCaixaRequest(
                CaixaMovimento.TipoMovimento.ESTORNO,
                valorEstornoCaixa,
                forma,
                motivo.length() > 255 ? motivo.substring(0, 255) : motivo,
                currentUsuarioNome()
        ));
        return aberto.get().getId();
    }

    private ContaReceberPagamentoResponse toPagamentoResponse(ContaReceberPagamento p) {
        return ContaReceberPagamentoResponse.builder()
                .id(p.getId())
                .contaReceberId(p.getContaReceberId())
                .caixaId(p.getCaixaId())
                .usuarioId(p.getUsuarioId())
                .formaPagamentoId(p.getFormaPagamentoId())
                .valorPago(p.getValorPago())
                .valorDesconto(p.getValorDesconto())
                .valorJuros(p.getValorJuros())
                .dataPagamento(p.getDataPagamento())
                .observacao(p.getObservacao())
                .criadoEm(p.getCriadoEm())
                .build();
    }

    @Transactional
    public ContaReceberResponse cancelar(UUID id) {
        UUID lojaId = TenantContext.requireCurrentLojaId();
        ContaReceber e = repository.findByIdAndLojaId(id, lojaId)
                .orElseThrow(() -> new EntityNotFoundException("Conta a receber não encontrada"));
        if (e.getStatus() == ContaReceber.StatusConta.PAGO) {
            throw new IllegalStateException("Conta já paga não pode ser cancelada");
        }
        e.setStatus(ContaReceber.StatusConta.CANCELADO);
        e = repository.save(e);
        log.info("ContaReceber cancelada loja={} id={}", lojaId, id);
        return mapper.toResponse(e);
    }
}
