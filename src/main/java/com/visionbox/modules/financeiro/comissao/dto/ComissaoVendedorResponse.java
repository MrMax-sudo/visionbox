package com.visionbox.modules.financeiro.comissao.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Vendedor ativo da loja que apura comissão (§3.6) — opções do picker de
 * apuração/fechamento (substitui a listagem de /v1/usuarios, ADMIN-only).
 * <p>
 * Perfis que apuram: VENDEDOR e OTICO — o plano de robustez define o lançamento
 * como "vinculado à venda e ao consultor ótico/vendedor"
 * (docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md §3.6) e Perfil.java os marca
 * como perfis de venda/atendimento (VENDEDOR = PDV/cliente, OTICO = grau/receita).
 * A apuração em si não restringe perfil (aceita qualquer usuarioId da loja) —
 * este endpoint só alimenta o seletor.
 * <p>
 * LGPD minimização (R7): apenas id + nome — sem email/CPF/outras PII.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComissaoVendedorResponse {
    private UUID id;
    private String nome;
}
