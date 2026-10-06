-- V13__financeiro_conta_receber.sql — VisionBox US13 Financeiro

CREATE TABLE IF NOT EXISTS conta_receber (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    cliente_id UUID REFERENCES cliente(id) ON DELETE SET NULL,
    pedido_id UUID,
    ordem_servico_id UUID REFERENCES ordem_servico(id) ON DELETE SET NULL,
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
    CONSTRAINT chk_conta_receber_pago_le_valor CHECK (valor_pago <= valor)
);

CREATE INDEX IF NOT EXISTS idx_conta_receber_loja ON conta_receber(loja_id);
CREATE INDEX IF NOT EXISTS idx_conta_receber_loja_status ON conta_receber(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_conta_receber_loja_cliente ON conta_receber(loja_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_conta_receber_vencimento ON conta_receber(loja_id, vencimento);
CREATE INDEX IF NOT EXISTS idx_conta_receber_loja_vencimento_status ON conta_receber(loja_id, status, vencimento) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_conta_receber_pedido ON conta_receber(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conta_receber_os ON conta_receber(ordem_servico_id) WHERE ordem_servico_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_conta_receber_atualizado ON conta_receber;
CREATE TRIGGER trg_conta_receber_atualizado
  BEFORE UPDATE ON conta_receber
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE conta_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta_receber FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON conta_receber;
CREATE POLICY loja_isolation ON conta_receber
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON conta_receber TO app_api, app_pdv;
GRANT SELECT ON conta_receber TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON conta_receber TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON conta_receber FROM app_readonly;

COMMENT ON TABLE conta_receber IS 'Conta a receber — gerada ao fechar PDV/OS. valor HALF_EVEN 2 casas. status PENDENTE/PAGO/CANCELADO';
