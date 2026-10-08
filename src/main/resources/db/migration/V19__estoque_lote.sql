-- V16__estoque_lote.sql — VisionBox Estoque Lote para Recall
-- Domínio: EstoqueLote (produtoId, lote, validade, quantidade) — rastreio lote/validade para recall bloqueável
-- Multi-tenant loja_id NOT NULL + timestamptz + RLS fail-closed

CREATE OR REPLACE FUNCTION fn_set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS estoque_lote (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    produto_id UUID NOT NULL,
    lote VARCHAR(50) NOT NULL,
    validade DATE,
    quantidade INT NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    bloqueado BOOLEAN NOT NULL DEFAULT false,
    motivo_bloqueio VARCHAR(500),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_estoque_lote_loja_produto_lote UNIQUE (loja_id, produto_id, lote)
);

CREATE INDEX IF NOT EXISTS idx_estoque_lote_loja ON estoque_lote(loja_id);
CREATE INDEX IF NOT EXISTS idx_estoque_lote_produto ON estoque_lote(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_lote_loja_produto ON estoque_lote(loja_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_lote_validade ON estoque_lote(loja_id, validade) WHERE validade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estoque_lote_bloqueado ON estoque_lote(loja_id, bloqueado) WHERE bloqueado = true;
CREATE INDEX IF NOT EXISTS idx_estoque_lote_vencido ON estoque_lote(loja_id, validade) WHERE validade < CURRENT_DATE AND ativo = true;

DROP TRIGGER IF EXISTS trg_estoque_lote_atualizado ON estoque_lote;
CREATE TRIGGER trg_estoque_lote_atualizado
  BEFORE UPDATE ON estoque_lote
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE estoque_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_lote FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON estoque_lote;
CREATE POLICY loja_isolation ON estoque_lote
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON estoque_lote TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON estoque_lote TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON estoque_lote TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON estoque_lote FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE estoque_lote IS 'Estoque por lote/validade — recall: bloqueado=true impede venda/entrega; vencido = validade < hoje; rastreio LGPD consumidor';
COMMENT ON COLUMN estoque_lote.lote IS 'Código lote do fabricante — único por (loja_id, produto_id, lote)';
COMMENT ON COLUMN estoque_lote.validade IS 'Data validade para lentes/medicamentos; null para armações sem validade';
