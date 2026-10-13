-- V34__conta_receber_pagamento.sql — Fase 3 Robustez: Financeiro Completo com Baixas Parciais
-- Referência canônica: docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md §3.3 + Outbox ERP (ContaReceberPagamento)
-- Conteúdo:
--   1) tabela conta_receber_pagamento (histórico de baixas parciais/totais)
--   2) tabela fornecedor (CNPJ cifrado AES-GCM+HMAC — ADR-002)
--   3) conta_receber: coluna derivada valor_aberto (valor - valor_pago)
--   4) conta_pagar: fornecedor_id, data_competencia, comprovante_url
--   5) caixa_movimento: tipos ENTRADA e RECEBIMENTO_FIADO (lançamento da baixa no caixa aberto)
-- Multi-tenant: loja_id NOT NULL + timestamptz + numeric(12,2) + RLS FORCE fail-closed (R1/ADR-001)

-- ==========================================================================
-- 1) conta_receber_pagamento — histórico imutável de baixas
-- ==========================================================================
CREATE TABLE IF NOT EXISTS conta_receber_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    conta_receber_id UUID NOT NULL REFERENCES conta_receber(id) ON DELETE CASCADE,
    caixa_id UUID REFERENCES caixa_sessao(id) ON DELETE SET NULL,
    usuario_id UUID,
    forma_pagamento_id UUID REFERENCES forma_pagamento(id) ON DELETE SET NULL,
    valor_pago NUMERIC(12,2) NOT NULL CHECK (valor_pago > 0),
    data_pagamento TIMESTAMPTZ NOT NULL DEFAULT now(),
    observacao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conta_receber_pagamento_conta ON conta_receber_pagamento(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_conta_receber_pagamento_loja ON conta_receber_pagamento(loja_id);
CREATE INDEX IF NOT EXISTS idx_conta_receber_pagamento_loja_conta_data
    ON conta_receber_pagamento(loja_id, conta_receber_id, data_pagamento);
CREATE INDEX IF NOT EXISTS idx_conta_receber_pagamento_caixa ON conta_receber_pagamento(caixa_id) WHERE caixa_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_conta_receber_pagamento_atualizado ON conta_receber_pagamento;
CREATE TRIGGER trg_conta_receber_pagamento_atualizado
  BEFORE UPDATE ON conta_receber_pagamento
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE conta_receber_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta_receber_pagamento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON conta_receber_pagamento;
CREATE POLICY loja_isolation ON conta_receber_pagamento
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON conta_receber_pagamento TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON conta_receber_pagamento TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON conta_receber_pagamento TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON conta_receber_pagamento FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE conta_receber_pagamento IS 'Histórico de baixas de Conta a Receber (parcial/total) — §3.3 Plano Robustez. caixa_id nullable: baixa sem caixa aberto fica sem vínculo de turno.';
COMMENT ON COLUMN conta_receber_pagamento.usuario_id IS 'Operador que recebeu (deriva do JWT como em CaixaController — nameUUIDFromBytes(username)).';

-- ==========================================================================
-- 2) fornecedor — cadastro com CNPJ cifrado (R2/ADR-002, padrão CPF do Cliente)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS fornecedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    nome VARCHAR(200) NOT NULL,
    cnpj_cipher BYTEA,
    cnpj_hash VARCHAR(64),
    contato VARCHAR(120),
    telefone VARCHAR(20),
    email VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

-- Dedup por loja via hash HMAC (mesmo padrão do CPF do Cliente)
CREATE UNIQUE INDEX IF NOT EXISTS uk_fornecedor_loja_cnpj_hash
    ON fornecedor(loja_id, cnpj_hash) WHERE cnpj_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fornecedor_loja_ativo ON fornecedor(loja_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedor_loja_nome ON fornecedor(loja_id, nome);
CREATE INDEX IF NOT EXISTS idx_fornecedor_nome_trgm ON fornecedor USING gin (nome gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_fornecedor_atualizado ON fornecedor;
CREATE TRIGGER trg_fornecedor_atualizado
  BEFORE UPDATE ON fornecedor
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON fornecedor;
CREATE POLICY loja_isolation ON fornecedor
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON fornecedor TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON fornecedor TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON fornecedor TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON fornecedor FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE fornecedor IS 'Fornecedor/credor da ótica — CNPJ cifrado AES-256-GCM + HMAC (cnpj_cipher/cnpj_hash), dedup parcial por loja_id + cnpj_hash (R2/ADR-002).';

-- ==========================================================================
-- 3) conta_receber: valor_aberto derivado (coluna "valorAberto" do §3.3)
--    Mantém compat: 'valor' = valorOriginal; valor_pago = total baixado.
--    GENERATED ALWAYS impede divergência de sincronização.
-- ==========================================================================
ALTER TABLE conta_receber
    ADD COLUMN IF NOT EXISTS valor_aberto NUMERIC(12,2) GENERATED ALWAYS AS (valor - valor_pago) STORED;

COMMENT ON COLUMN conta_receber.valor_aberto IS 'Valor em aberto (§3.3) = valor - valor_pago. Coluna derivada generated — fonte permanece valor/valor_pago.';

-- ==========================================================================
-- 4) conta_pagar: vínculo fornecedor + competência + comprovante (§3.3)
-- ==========================================================================
ALTER TABLE conta_pagar ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedor(id) ON DELETE SET NULL;
ALTER TABLE conta_pagar ADD COLUMN IF NOT EXISTS data_competencia DATE;
ALTER TABLE conta_pagar ADD COLUMN IF NOT EXISTS comprovante_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_conta_pagar_fornecedor_id ON conta_pagar(loja_id, fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conta_pagar_competencia ON conta_pagar(loja_id, data_competencia) WHERE data_competencia IS NOT NULL;

COMMENT ON COLUMN conta_pagar.fornecedor_id IS 'Vínculo opcional com cadastro de fornecedor (V34). Coluna legada "fornecedor" (texto) mantida para DRE/compat.';
COMMENT ON COLUMN conta_pagar.data_competencia IS 'Data de competência da despesa (regime de competência) — DRE. vencimento continua sendo a data de vencimento.';
COMMENT ON COLUMN conta_pagar.comprovante_url IS 'Chave/URL do comprovante de pagamento digitalizado (S3/MinIO).';

-- ==========================================================================
-- 5) caixa_movimento: novos tipos de baixa de título (ENTRADA / RECEBIMENTO_FIADO)
-- ==========================================================================
ALTER TABLE caixa_movimento DROP CONSTRAINT IF EXISTS caixa_movimento_tipo_check;
ALTER TABLE caixa_movimento DROP CONSTRAINT IF EXISTS ck_caixa_movimento_tipo;
ALTER TABLE caixa_movimento ADD CONSTRAINT caixa_movimento_tipo_check
    CHECK (tipo IN ('ABERTURA', 'SUPRIMENTO', 'SANGRIA', 'VENDA_DINHEIRO', 'VENDA_OUTROS',
                    'ESTORNO', 'FECHAMENTO', 'ENTRADA', 'RECEBIMENTO_FIADO'));


