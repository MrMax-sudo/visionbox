package com.visionbox.modules.ordemservico.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrdemServicoResponse {
    private UUID id;
    private UUID lojaId;
    private String numero;
    private UUID clienteId;
    private UUID receitaId;
    private UUID armacaoId;
    private UUID lenteId;
    private UUID laboratorioId;
    private String status;
    private OffsetDateTime previsaoEntrega;
    private OffsetDateTime dataEntregaReal;
    private boolean alertaAtrasoDisparado;
    private List<EventoOSResponse> historico;
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
}
