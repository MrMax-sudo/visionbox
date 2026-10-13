package com.visionbox.modules.financeiro.comissao.dto;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoConfig.TipoComissao;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComissaoConfigRequest {

    @NotNull(message = "tipo é obrigatório (GERAL|CATEGORIA)")
    private TipoComissao tipo;

    /** Obrigatória quando tipo = CATEGORIA (validado no service). */
    @Size(max = 100, message = "categoria deve ter no máximo 100 caracteres")
    private String categoria;

    @NotNull(message = "percentual é obrigatório")
    @DecimalMin(value = "0", message = "percentual deve ser >= 0")
    @DecimalMax(value = "100", message = "percentual deve ser <= 100")
    private BigDecimal percentual;

    private Boolean ativo;
}
