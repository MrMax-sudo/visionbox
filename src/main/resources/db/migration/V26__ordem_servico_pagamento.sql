-- V26__ordem_servico_pagamento.sql
-- Pagamentos multi-forma de Ordem de Serviço (PDV FinalizarVendaModal).
-- Referencia forma_pagamento (tabela V25) e persiste valor por forma.
CREATE TABLE IF NOT EXISTS ordem_servico_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    ordem_servico_id UUID NOT NULL REFERENCES ordem_servico(id),
    forma_pagamento_id UUID NOT NULL REFERENCES forma_pagamento(id),
    forma_pagamento_nome VARCHAR(100),
    valor NUMERIC(12, 2) NOT NULL CHECK (valor >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_osp_os ON ordem_servico_pagamento(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_osp_loja ON ordem_servico_pagamento(loja_id);
CREATE INDEX IF NOT EXISTS idx_osp_forma ON ordem_servico_pagamento(forma_pagamento_id);

ALTER TABLE ordem_servico_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_servico_pagamento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON ordem_servico_pagamento;
CREATE POLICY loja_isolation ON ordem_servico_pagamento
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON ordem_servico_pagamento TO app_api, app_pdv;
GRANT SELECT ON ordem_servico_pagamento TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ordem_servico_pagamento TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON ordem_servico_pagamento FROM app_readonly;

COMMENT ON TABLE ordem_servico_pagamento IS 'Pagamentos multi-forma da Ordem de Serviço — snapshots forma_pagamento_nome para histórico';