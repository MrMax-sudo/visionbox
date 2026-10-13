package com.visionbox.modules.modulos.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * DTOs do Gestor SaaS de Módulos & Planos (spec §4.3/§4.4).
 */
public final class ModuloDtos {

    private ModuloDtos() {
    }

    /**
     * Status de um módulo para a loja consultada.
     *
     * @param codigo  código do {@code ModuloSistema}
     * @param nome    nome de exibição
     * @param descricao descrição curta
     * @param rotas   prefixos de rota protegidos
     * @param ativo   se a loja tem o módulo liberado
     * @param fonte   PADRAO (sem linha = default retrocompatível) | REGISTRO (linha gravada)
     */
    public record ModuloStatusResponse(
            String codigo,
            String nome,
            String descricao,
            List<String> rotas,
            boolean ativo,
            String fonte) {
    }

    /**
     * Visão completa dos módulos de uma loja.
     *
     * @param planoAtual      PADRAO | START | PRO | ENTERPRISE | PERSONALIZADO
     * @param registrosExistem se a loja já tem ao menos uma linha materializada em V36
     */
    public record ModuloConfiguracaoStatusResponse(
            UUID lojaId,
            String planoAtual,
            boolean registrosExistem,
            List<ModuloStatusResponse> modulos) {
    }

    /** Item de toggle granular (overriding avulso, spec §4.3 item 3). */
    public record ItemModuloRequest(
            @NotBlank String codigo,
            @NotNull Boolean ativo) {
    }

    /** Toggle em lote — persistência imediata com auditoria (spec §4.3 item 4). */
    public record AlternarModulosRequest(
            @NotEmpty @Valid List<ItemModuloRequest> modulos,
            String observacao) {
    }

    /** Aplicação de plano (Start/Pro/Enterprise) — grava TODOS os módulos da matriz. */
    public record AplicarPlanoRequest(@NotBlank String plano) {
    }

    /** Resumo mínimo de loja para o seletor do Painel (LGPD: só id + nome, sem CNPJ). */
    public record LojaResumoResponse(UUID id, String nome) {
    }
}
