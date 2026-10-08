-- V20__caixa_sessao.sql — VisionBox Controle de Caixa PDV & Financeiro

CREATE TABLE IF NOT EXISTS caixa_sessao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    usuario_id UUID NOT NULL,
    operador_nome VARCHAR(120),
    identificacao_caixa VARCHAR(50) NOT NULL DEFAULT 'CAIXA_01',
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO')),
    aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_em TIMESTAMPTZ,
    saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
    total_entradas NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_saidas NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_esperado NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_informado_fechamento NUMERIC(12,2),
    diferenca_fechamento NUMERIC(12,2),
    observacao_fechamento VARCHAR(500),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS caixa_movimento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    sessao_id UUID NOT NULL REFERENCES caixa_sessao(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('ABERTURA', 'SUPRIMENTO', 'SANGRIA', 'VENDA_DINHEIRO', 'VENDA_OUTROS', 'ESTORNO', 'FECHAMENTO')),
    valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
    forma_pagamento VARCHAR(30),
    motivo VARCHAR(255),
    usuario_nome VARCHAR(120),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_sessao_loja_status ON caixa_sessao(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_caixa_sessao_aberto_em ON caixa_sessao(loja_id, aberto_em);
CREATE INDEX IF NOT EXISTS idx_caixa_movimento_sessao ON caixa_movimento(sessao_id);
CREATE INDEX IF NOT EXISTS idx_caixa_movimento_loja ON caixa_movimento(loja_id);

DROP TRIGGER IF EXISTS trg_caixa_sessao_atualizado ON caixa_sessao;
CREATE TRIGGER trg_caixa_sessao_atualizado
  BEFORE UPDATE ON caixa_sessao
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE caixa_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_sessao FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON caixa_sessao;
CREATE POLICY loja_isolation ON caixa_sessao
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

ALTER TABLE caixa_movimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON caixa_movimento;
CREATE POLICY loja_isolation ON caixa_movimento
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON caixa_sessao TO app_api, app_pdv;
GRANT SELECT ON caixa_sessao TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON caixa_sessao TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON caixa_sessao FROM app_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE ON caixa_movimento TO app_api, app_pdv;
GRANT SELECT ON caixa_movimento TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON caixa_movimento TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON caixa_movimento FROM app_readonly;

COMMENT ON TABLE caixa_sessao IS 'Sessão de Caixa PDV — Abertura, Sangria, Suprimento e Fechamento com conferência cega/diferença';
COMMENT ON TABLE caixa_movimento IS 'Movimentações avulsas ou de vendas no caixa físico da loja';
