package com.visionbox.modules.financeiro.comissao.dto;

import com.visionbox.modules.financeiro.comissao.domain.ComissaoConfig.TipoComissao;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComissaoConfigResponse {
    private UUID id;
    private TipoComissao tipo;
    private String categoria;
    private BigDecimal percentual;
    private boolean ativo;
}
