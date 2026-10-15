package com.visionbox.modules.orcamento.dto;

import com.visionbox.modules.orcamento.domain.OrcamentoStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrcamentoResponse {
    private UUID id;
    private UUID lojaId;
    private String numero;
    private UUID clienteId;
    private String clienteNome;
    private String clienteCpf;
    private String clienteTelefone;
    private UUID vendedorId;
    private String vendedorNome;
    private BigDecimal valorSubtotal;
    private BigDecimal desconto;
    private BigDecimal valorTotal;
    private Integer validadeDias;
    private OrcamentoStatus status;
    private String observacoes;
    private String condicoesPagamento;
    private UUID vendaId;
    private List<OrcamentoItemResponse> itens;
    private OffsetDateTime criadoEm;
    private OffsetDateTime atualizadoEm;
}
