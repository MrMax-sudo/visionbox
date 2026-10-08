-- V25__forma_pagamento.sql
-- Formas de Pagamento aceitas no PDV (multi-forma), alinhado ao padrão V23 (caixa).
CREATE TABLE IF NOT EXISTS forma_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'CREDIARIO')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    padrao BOOLEAN NOT NULL DEFAULT FALSE,
    taxa_percentual NUMERIC(5, 2),
    prazo_dias INTEGER,
    permite_parcelar BOOLEAN NOT NULL DEFAULT FALSE,
    max_parcelas INTEGER,
    t_pag_nfce VARCHAR(2),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_forma_pagamento_parcelas CHECK (permite_parcelar = FALSE OR max_parcelas IS NULL OR max_parcelas >= 1)
);

CREATE INDEX IF NOT EXISTS idx_forma_pagamento_loja_ativo ON forma_pagamento(loja_id, ativo);

DROP TRIGGER IF EXISTS trg_forma_pagamento_atualizado ON forma_pagamento;
CREATE TRIGGER trg_forma_pagamento_atualizado
  BEFORE UPDATE ON forma_pagamento
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS segunda barreira (padrão V11/V23: fail-closed via app.current_loja_id())
ALTER TABLE forma_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE forma_pagamento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON forma_pagamento;
CREATE POLICY loja_isolation ON forma_pagamento
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON forma_pagamento TO app_api, app_pdv;
GRANT SELECT ON forma_pagamento TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON forma_pagamento TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON forma_pagamento FROM app_readonly;

-- Seed padrão da loja matriz (loja_id 00000000-0000-0000-0000-000000000001)
-- RLS FORCE exige que a sessão de migração tenha privilégios de owner (Flyway)
-- para inserir; em banco limpo o Flyway roda como superuser/owner (sem RLS barrando).
INSERT INTO forma_pagamento (loja_id, nome, tipo, ativo, padrao, t_pag_nfce)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Dinheiro', 'DINHEIRO', true, true, '01'
WHERE NOT EXISTS (SELECT 1 FROM forma_pagamento WHERE loja_id = '00000000-0000-0000-0000-000000000001'::uuid);
INSERT INTO forma_pagamento (loja_id, nome, tipo, ativo, padrao, t_pag_nfce)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'PIX', 'PIX', true, false, '17'
WHERE NOT EXISTS (SELECT 1 FROM forma_pagamento WHERE loja_id = '00000000-0000-0000-0000-000000000001'::uuid AND tipo = 'PIX');
INSERT INTO forma_pagamento (loja_id, nome, tipo, ativo, padrao, t_pag_nfce)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Cartão de Débito', 'DEBITO', true, false, '04'
WHERE NOT EXISTS (SELECT 1 FROM forma_pagamento WHERE loja_id = '00000000-0000-0000-0000-000000000001'::uuid AND tipo = 'DEBITO');
INSERT INTO forma_pagamento (loja_id, nome, tipo, ativo, padrao, t_pag_nfce)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Cartão de Crédito', 'CREDITO', true, false, '03'
WHERE NOT EXISTS (SELECT 1 FROM forma_pagamento WHERE loja_id = '00000000-0000-0000-0000-000000000001'::uuid AND tipo = 'CREDITO');
INSERT INTO forma_pagamento (loja_id, nome, tipo, ativo, padrao, t_pag_nfce)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Crediário Próprio', 'CREDIARIO', true, false, '99'
WHERE NOT EXISTS (SELECT 1 FROM forma_pagamento WHERE loja_id = '00000000-0000-0000-0000-000000000001'::uuid AND tipo = 'CREDIARIO');