package com.visionbox.modules.vendas.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CancelarVendaRequest {
    @NotBlank(message = "Motivo do cancelamento é obrigatório")
    private String motivo;
}
