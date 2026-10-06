package com.visionbox.modules.caixa.service;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import com.visionbox.modules.caixa.dto.CaixaDTOs.*;
import com.visionbox.modules.caixa.repository.CaixaMovimentoRepository;
import com.visionbox.modules.caixa.repository.CaixaSessaoRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CaixaService {

    private final CaixaSessaoRepository sessaoRepository;
    private final CaixaMovimentoRepository movimentoRepository;

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
                    .formaPagamento("DINHEIRO")
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
        }

        CaixaMovimento mov = CaixaMovimento.builder()
                .lojaId(lojaId)
                .sessao(sessao)
                .tipo(req.tipo())
                .valor(valor)
                .formaPagamento(req.formaPagamento() != null ? req.formaPagamento() : "DINHEIRO")
                .motivo(req.motivo())
                .usuarioNome(req.usuarioNome())
                .criadoEm(OffsetDateTime.now())
                .build();

        movimentoRepository.save(mov);
        sessao.getMovimentos().add(mov);
        sessaoRepository.save(sessao);

        return toDTO(sessao);
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
        sessao.setDiferencaFechamento(diferenca);
        sessao.setObservacaoFechamento(req.observacao());

        CaixaMovimento movFechamento = CaixaMovimento.builder()
                .lojaId(lojaId)
                .sessao(sessao)
                .tipo(CaixaMovimento.TipoMovimento.FECHAMENTO)
                .valor(informado)
                .formaPagamento("CONFERENCIA")
                .motivo("Fechamento com saldo informado R$ " + informado + " (diferença: R$ " + diferenca + ")")
                .usuarioNome(sessao.getOperadorNome())
                .criadoEm(OffsetDateTime.now())
                .build();

        movimentoRepository.save(movFechamento);
        sessao.getMovimentos().add(movFechamento);
        sessao = sessaoRepository.save(sessao);

        log.info("Caixa fechado com sucesso lojaId={} sessaoId={} esperado={} informado={} diferenca={}",
                lojaId, sessao.getId(), esperado, informado, diferenca);

        return toDTO(sessao);
    }

    @Transactional(readOnly = true)
    public Page<CaixaSessaoDTO> listarHistorico(UUID lojaId, Pageable pageable) {
        return sessaoRepository.findByLojaIdOrderByAbertoEmDesc(lojaId, pageable)
                .map(this::toDTO);
    }

    private CaixaSessaoDTO toDTO(CaixaSessao s) {
        List<CaixaMovimentoDTO> movs = s.getMovimentos() != null
                ? s.getMovimentos().stream().map(m -> new CaixaMovimentoDTO(
                m.getId(),
                m.getTipo(),
                m.getValor(),
                m.getFormaPagamento(),
                m.getMotivo(),
                m.getUsuarioNome(),
                m.getCriadoEm()
        )).collect(Collectors.toList())
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
                s.getDiferencaFechamento(),
                s.getObservacaoFechamento(),
                movs
        );
    }
}
