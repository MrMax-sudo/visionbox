package com.visionbox.modules.caixa.dto;

import com.visionbox.modules.caixa.domain.CaixaMovimento;
import com.visionbox.modules.caixa.domain.CaixaSessao;
import jakarta.validation.constraints.DecimalMin;
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
            BigDecimal diferencaFechamento,
            String observacaoFechamento,
            List<CaixaMovimentoDTO> movimentos
    ) {}
}
