package com.visionbox.modules.ordemservico.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrdemServicoResponse {
    private UUID id;
    private UUID lojaId;
    private String numero;
    private UUID clienteId;
    private String clienteNome;
    private String clienteWhatsapp;
    private UUID receitaId;
    private UUID armacaoId;
    private UUID lenteId;
    private UUID laboratorioId;
    private String status;
    private OffsetDateTime previsaoEntrega;
    private OffsetDateTime dataEntregaReal;
    private boolean alertaAtrasoDisparado;
    private String tokenRastreio;
    private List<EventoOSResponse> historico;
    private List<PagamentoResponse> pagamentos;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EventoOSResponse {
        private UUID id;
        private String statusAnterior;
        private String statusNovo;
        private OffsetDateTime dataHora;
        private String responsavel;
        private String observacao;
    }

    /**
     * Pagamento da OS (§3.5) — contrato consumido pelo front (OSDetail/PDV):
     * taxaValor/valorLiquido são null quando o MDR está pendente (V37 tri-state,
     * front trata com {@code valorLiquido ?? valor}); maquininhaId null quando o
     * MDR não foi aplicado; parcelas 1 = à vista (V40).
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PagamentoResponse {
        private UUID id;
        private UUID formaPagamentoId;
        private String formaPagamentoNome;
        private BigDecimal valor;
        private BigDecimal taxaValor;
        private BigDecimal valorLiquido;
        private UUID maquininhaId;
        private Integer parcelas;
    }
}
