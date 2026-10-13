package com.visionbox.modules.caixa.dto;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class CaixaDTOs {

    public record AbrirCaixaRequest(
            @NotNull @DecimalMin(value = "0.00") BigDecimal saldoInicial,
            String identificacaoCaixa,
            String operadorNome
    ) {}

    public record MovimentarCaixaRequest(
            @NotNull CaixaMovimento.TipoMovimento tipo,
            @NotNull @DecimalMin(value = "0.01") BigDecimal valor,
            String formaPagamento,
            String motivo,
            String usuarioNome
    ) {}

    public record FecharCaixaRequest(
            @NotNull @DecimalMin(value = "0.00") BigDecimal saldoInformado,
            String observacao
    ) {}

    /**
     * Sangria (retirada) ou Suprimento (aporte) de gaveta — Fase 2 Plano de Robustez.
     * Motivo e valor são obrigatórios (auditoria de movimentações de gaveta).
     */
    public record SangriaSuprimentoRequest(
            @NotNull @DecimalMin(value = "0.01") BigDecimal valor,
            @NotBlank String motivo,
            String formaPagamento,
            String usuarioNome
    ) {}

    /** Resumo por modalidade de pagamento vindas das vendas (formas de pagamento do banco). */
    public record ResumoModalidadeDTO(
            UUID formaPagamentoId,
            String nome,
            BigDecimal total
    ) {}

    /** Relatório consolidado de fechamento de turno — JSON base para cupom térmico 80mm. */
    public record RelatorioFechamentoDTO(
            UUID sessaoId,
            String identificacaoCaixa,
            String operadorNome,
            CaixaSessao.StatusCaixa status,
            OffsetDateTime abertoEm,
            OffsetDateTime fechadoEm,
            BigDecimal saldoInicial,
            BigDecimal totalEntradas,
            BigDecimal totalSaidas,
            BigDecimal valorFechamentoSistema,
            BigDecimal valorFechamentoInformado,
            BigDecimal diferencaFechamento,
            String classificacaoDiferenca,
            String observacaoFechamento,
            BigDecimal totalVendas,
            BigDecimal totalSangrias,
            BigDecimal totalSuprimentos,
            List<ResumoModalidadeDTO> resumoPorModalidade,
            List<CaixaMovimentoDTO> movimentos
    ) {}

    public record CaixaMovimentoDTO(
            UUID id,
            CaixaMovimento.TipoMovimento tipo,
            BigDecimal valor,
            String formaPagamento,
            String motivo,
            String usuarioNome,
            OffsetDateTime criadoEm
    ) {}

    public record CaixaSessaoDTO(
            UUID id,
            UUID lojaId,
            UUID usuarioId,
            String operadorNome,
            String identificacaoCaixa,
            CaixaSessao.StatusCaixa status,
            OffsetDateTime abertoEm,
            OffsetDateTime fechadoEm,
            BigDecimal saldoInicial,
            BigDecimal totalEntradas,
            BigDecimal totalSaidas,
            BigDecimal saldoEsperado,
            BigDecimal saldoInformadoFechamento,
            BigDecimal valorFechamentoSistema,
            BigDecimal diferencaFechamento,
            String classificacaoDiferenca,
            String observacaoFechamento,
            List<CaixaMovimentoDTO> movimentos
    ) {}
}
