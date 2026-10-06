-- V12__estoque.sql — VisionBox US09 Estoque
-- Entidade Estoque: loja_id, produto_id, quantidade, reservado

CREATE OR REPLACE FUNCTION fn_set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    produto_id UUID NOT NULL,
    quantidade INT NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    reservado INT NOT NULL DEFAULT 0 CHECK (reservado >= 0),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_estoque_loja_produto UNIQUE (loja_id, produto_id),
    CONSTRAINT chk_estoque_reservado_le_quantidade CHECK (reservado <= quantidade)
);

CREATE INDEX IF NOT EXISTS idx_estoque_loja ON estoque(loja_id);
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_loja_produto ON estoque(loja_id, produto_id);

DROP TRIGGER IF EXISTS trg_estoque_atualizado ON estoque;
CREATE TRIGGER trg_estoque_atualizado
  BEFORE UPDATE ON estoque
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS (caso V11 já rodou, esta policy será recriada dinamicamente; garantir aqui também)
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON estoque;
CREATE POLICY loja_isolation ON estoque
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON estoque TO app_api, app_pdv;
GRANT SELECT ON estoque TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON estoque TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON estoque FROM app_readonly;

COMMENT ON TABLE estoque IS 'Estoque por produto/loja — quantidade física e reservado (OS). Invariante reservado <= quantidade';
