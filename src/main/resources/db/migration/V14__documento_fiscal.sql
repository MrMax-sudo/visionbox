-- V14__documento_fiscal.sql — VisionBox Fiscal NFC-e 65 / NF-e 55
-- Mantém MockFiscalProvider; cria tabela documento_fiscal se ainda não existe

CREATE TABLE IF NOT EXISTS documento_fiscal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    modelo VARCHAR(10) NOT NULL CHECK (modelo IN ('NFE_55','NFCE_65')),
    serie VARCHAR(3) NOT NULL,
    numero INT NOT NULL,
    chave_acesso VARCHAR(44),
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','PENDENTE','AUTORIZADO','REJEITADO','CANCELADO','CONTINGENCIA','INUTILIZADO','DENEGADO')),
    ambiente VARCHAR(1) NOT NULL DEFAULT '2' CHECK (ambiente IN ('1','2')),
    tp_emis VARCHAR(1) NOT NULL DEFAULT '1',
    xml_enviado TEXT,
    xml_retorno TEXT,
    protocolo VARCHAR(15),
    codigo_status VARCHAR(3),
    motivo VARCHAR(500),
    dh_emissao TIMESTAMPTZ NOT NULL DEFAULT now(),
    dh_autorizacao TIMESTAMPTZ,
    pedido_id UUID,
    ordem_servico_id UUID REFERENCES ordem_servico(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_doc_loja_modelo_serie_numero UNIQUE (loja_id, modelo, serie, numero)
);

CREATE INDEX IF NOT EXISTS idx_doc_fiscal_loja ON documento_fiscal(loja_id);
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_loja_status ON documento_fiscal(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_chave ON documento_fiscal(chave_acesso) WHERE chave_acesso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_pedido ON documento_fiscal(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_fiscal_os ON documento_fiscal(ordem_servico_id) WHERE ordem_servico_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_documento_fiscal_atualizado ON documento_fiscal;
CREATE TRIGGER trg_documento_fiscal_atualizado
  BEFORE UPDATE ON documento_fiscal
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE documento_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_fiscal FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON documento_fiscal;
CREATE POLICY loja_isolation ON documento_fiscal
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON documento_fiscal TO app_api, app_pdv;
GRANT SELECT ON documento_fiscal TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON documento_fiscal TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON documento_fiscal FROM app_readonly;

COMMENT ON TABLE documento_fiscal IS 'Documento fiscal NFC-e 65 / NF-e 55 — MockFiscalProvider gera chave 44 + protocolo 15 + cStat 100 em dev/test';
