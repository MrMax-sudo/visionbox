package com.visionbox.modules.laboratorio.dto;

import com.visionbox.modules.ordemservico.domain.StatusOS;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LabPortalDetalhesResponse {

    private UUID ordemServicoId;
    private String numeroOs;
    private StatusOS statusAtual;
    private OffsetDateTime dataAbertura;
    private OffsetDateTime previsaoEntrega;

    // Dados da Armação e Lentes
    private String armacaoNome;
    private String armacaoSku;
    private String lenteNome;
    private String lenteSku;
    private List<String> tratamentos;
    private String observacoesLaboratorio;

    // Graus Óticos OD / OE
    private GrauOtico od;
    private GrauOtico oe;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GrauOtico {
        private String esferico;
        private String cilindrico;
        private Integer eixo;
        private String adicao;
        private String dnp;
        private String altura;
    }
}
