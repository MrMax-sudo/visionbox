-- V36__modulo_configuracao_loja.sql — Fase 5 (Plano de Robustez §4): Gestor SaaS de Módulos & Planos
-- Feature flagging por loja (R11): cada loja (tenant) tem 0..N linhas deste catálogo.
--
-- SEMÂNTICA DE DEFAULT (retrocompatibilidade — decisão registrada em docs/decisions.md D-014):
--   * loja SEM linha nesta tabela => TODOS os módulos considerados ATIVOS.
--     Nenhuma loja existente quebra ao aplicar esta migration (nada é bloqueado por default).
--   * loja COM linhas => vale exatamente o que está gravado (linha ausente nesse caso
--     também conta como ativo — cobertura parcial é permitida; a aplicação de plano
--     sempre grava TODOS os 19 módulos, nunca apaga linha).
--
-- Colunas seguem a spec §4.1/§5 (loja_id, modulo_codigo, ativo, plano_nome).
-- `ativo` aqui é o FLAG DE NEGÓCIO do módulo (spec) — por isso a entidade NÃO estende
-- EntidadeBase (lá `ativo` é soft-delete e ficaria conflito de semântica).
CREATE TABLE IF NOT EXISTS modulo_configuracao_loja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    modulo_codigo VARCHAR(40) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    plano_nome VARCHAR(30),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_modulo_configuracao_loja UNIQUE (loja_id, modulo_codigo),
    CONSTRAINT ck_modulo_configuracao_loja_codigo CHECK (modulo_codigo IN (
        'PDV_BALCAO',
        'ORDEM_SERVICO',
        'RECEITAS_CLINICAS',
        'CENTRAL_VENDAS',
        'CAIXA_TURNOS',
        'FINANCEIRO_COMPLETO',
        'FISCAL_FLOWBOX',
        'COMPRAS_XML',
        'ESTOQUE_LOTES',
        'ETIQUETAS',
        'SUGESTAO_COMPRAS',
        'SCANNER_MOVEL',
        'TABELAS_PRECO',
        'FIDELIDADE_PONTOS',
        'ORCAMENTO_ONLINE',
        'KITS_COMBOS',
        'LAB_PORTAL',
        'RASTREIO_CLIENTE',
        'ALERTAS_TELEGRAM'
    )),
    CONSTRAINT ck_modulo_configuracao_loja_plano CHECK (plano_nome IS NULL OR plano_nome IN (
        'PADRAO', 'START', 'PRO', 'ENTERPRISE', 'PERSONALIZADO'
    ))
);

CREATE INDEX IF NOT EXISTS idx_modulo_configuracao_loja_loja_ativo
    ON modulo_configuracao_loja(loja_id, ativo);

DROP TRIGGER IF EXISTS trg_modulo_configuracao_loja_atualizado ON modulo_configuracao_loja;
CREATE TRIGGER trg_modulo_configuracao_loja_atualizado
  BEFORE UPDATE ON modulo_configuracao_loja
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS segunda barreira (padrão V11/V25: fail-closed via app.current_loja_id())
ALTER TABLE modulo_configuracao_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE modulo_configuracao_loja FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON modulo_configuracao_loja;
CREATE POLICY loja_isolation ON modulo_configuracao_loja
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON modulo_configuracao_loja TO app_api, app_pdv;
GRANT SELECT ON modulo_configuracao_loja TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON modulo_configuracao_loja TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON modulo_configuracao_loja FROM app_readonly;

-- Seed: NENHUM de propósito (idempotência implícita do default "sem linha = tudo ativo").
-- Gravar linha materializa um plano explícito e passa a bloquear o que não estiver marcado;
-- só o Painel do Desenvolvedor decide quando materializar (aplicação de plano/toggle).
