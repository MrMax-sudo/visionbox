-- V15__conta_pagar.sql — VisionBox Financeiro Conta a Pagar
-- Domínio: ContaPagar (fornecedor, descricao, valor, vencimento, status)
-- Multi-tenant loja_id NOT NULL + timestamptz + numeric(12,2) HALF_EVEN + RLS fail-closed

-- Garante helper existe (V11), mas recria se necessário para idempotência em testes H2 -> não executa em PG apenas se não existe? Mantém compat
CREATE OR REPLACE FUNCTION fn_set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS conta_pagar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    fornecedor VARCHAR(200) NOT NULL,
    descricao VARCHAR(500),
    numero_documento VARCHAR(50),
    valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
    valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
    vencimento DATE NOT NULL,
    data_pagamento TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO','VENCIDO','CANCELADO','PARCIAL')),
    parcela INT CHECK (parcela IS NULL OR parcela > 0),
    total_parcelas INT CHECK (total_parcelas IS NULL OR total_parcelas > 0),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_conta_pagar_pago_le_valor CHECK (valor_pago <= valor)
);

CREATE INDEX IF NOT EXISTS idx_conta_pagar_loja ON conta_pagar(loja_id);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_loja_status ON conta_pagar(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_loja_fornecedor ON conta_pagar(loja_id, fornecedor);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_vencimento ON conta_pagar(loja_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_conta_pagar_loja_vencimento_status ON conta_pagar(loja_id, status, vencimento) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_conta_pagar_fornecedor_trgm ON conta_pagar USING gin (fornecedor gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_conta_pagar_atualizado ON conta_pagar;
CREATE TRIGGER trg_conta_pagar_atualizado
  BEFORE UPDATE ON conta_pagar
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS fail-closed via app.current_loja_id() (V11 helper)
ALTER TABLE conta_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta_pagar FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON conta_pagar;
CREATE POLICY loja_isolation ON conta_pagar
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

-- Grants (idempotente — ignora se roles não existem em H2/dev)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON conta_pagar TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON conta_pagar TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON conta_pagar TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON conta_pagar FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE conta_pagar IS 'Conta a pagar — fornecedor obrigatório, valor HALF_EVEN 2 casas, status PENDENTE/PAGO/CANCELADO, loja_id obrigatório';
COMMENT ON COLUMN conta_pagar.fornecedor IS 'Fornecedor/credor — usado para DRE custo e comissão quando contém COMISSAO';
