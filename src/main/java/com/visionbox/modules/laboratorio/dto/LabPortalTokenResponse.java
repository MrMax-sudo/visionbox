package com.visionbox.modules.laboratorio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LabPortalTokenResponse {
    private String token;
    private String tokenType;
    private OffsetDateTime expiraEm;
    private UUID ordemServicoId;
    private UUID lojaId;
    private UUID laboratorioId;
    private String laboratorioExternoId;
    private String statusOs;
}
