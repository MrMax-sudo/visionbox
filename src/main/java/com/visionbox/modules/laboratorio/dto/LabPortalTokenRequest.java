package com.visionbox.modules.laboratorio.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LabPortalTokenRequest {

    @NotNull
    private UUID ordemServicoId;

    @Size(max = 80)
    private String laboratorioExternoId;

    @Min(5)
    @Max(10080)
    private Integer ttlMinutos;
}
