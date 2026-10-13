package com.visionbox.modules.financeiro.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ContaPagarRequest {

    /** Nome/texto do credor. Obrigatório se fornecedorId não informado. */
    private String fornecedor;

    /** V34 — vínculo com cadastro de fornecedor (§3.3). Se informado, resolve o nome. */
    private UUID fornecedorId;

    private String descricao;

    private String numeroDocumento;

    @NotNull @Positive
    private BigDecimal valor;

    /** US13 DRE por OS — vínculo opcional com a ordem de serviço (custo direto da OS). */
    private UUID ordemServicoId;

    @NotNull(message = "vencimento é obrigatório (yyyy-MM-dd)")
    private String vencimento; // ISO LocalDate yyyy-MM-dd

    /** V34 — data de competência (yyyy-MM-dd, opcional). Default: vencimento. */
    private String dataCompetencia;

    /** V34 — chave/URL do comprovante de pagamento digitalizado (opcional). */
    private String comprovanteUrl;

    private Integer parcela;

    private Integer totalParcelas;
}
