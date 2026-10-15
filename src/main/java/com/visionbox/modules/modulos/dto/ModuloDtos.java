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

    /** Resumo da loja para o seletor do Painel e gestão SaaS. */
    public record LojaResumoResponse(
            UUID id,
            String nome,
            String codigo,
            String subdominio,
            String cnpj,
            String telefone,
            String emailContato,
            boolean ativo) {
        public LojaResumoResponse(UUID id, String nome) {
            this(id, nome, null, null, null, null, null, true);
        }
    }

    /** Payload para provisionamento de nova Loja/Empresa e seu Admin inicial. */
    public record CriarLojaRequest(
            @NotBlank String nome,
            String cnpj,
            String telefone,
            String emailContato,
            String subdominio,
            String plano,
            @NotBlank String adminNome,
            @NotBlank String adminEmail,
            @NotBlank String adminSenha) {
    }

    /** Payload para edição cadastral da Loja no Painel Dev. */
    public record EditarLojaRequest(
            @NotBlank String nome,
            String cnpj,
            String telefone,
            String emailContato,
            String subdominio,
            Boolean ativo) {
    }

    /** Resposta de sucesso do provisionamento da nova loja. */
    public record LojaCriadaResponse(
            UUID id,
            String nome,
            String codigo,
            String subdominio,
            String cnpj,
            String adminEmail,
            String plano) {
        public LojaCriadaResponse(UUID id, String nome, String cnpj, String adminEmail, String plano) {
            this(id, nome, null, null, cnpj, adminEmail, plano);
        }
    }
}

