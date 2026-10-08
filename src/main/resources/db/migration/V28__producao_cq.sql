-- V28__producao_cq.sql
-- Produção técnica: controle de início/fim e CQ com foto (reprovação exige foto)
-- Multi-tenant: loja_id UUID NOT NULL + RLS FORCE padrão V11/V25
CREATE TABLE IF NOT EXISTS producao_os (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    ordem_servico_id UUID NOT NULL REFERENCES ordem_servico(id),
    -- Controle de produção
    inicio_producao TIMESTAMPTZ,
    fim_producao TIMESTAMPTZ,
    -- Controle de Qualidade
    cq_aprovado BOOLEAN,
    cq_reprovado_motivo VARCHAR(500),
    -- Foto exigida quando CQ reprovado (segue padrão Receita: S3 key/bucket)
    foto_s3_key VARCHAR(512),
    foto_s3_bucket VARCHAR(255),
    foto_url VARCHAR(2048),
    -- Responsável
    responsavel_id UUID,
    responsavel_nome VARCHAR(200),
    observacao TEXT,
    -- Auditoria/base
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_producao_os_ordem UNIQUE (loja_id, ordem_servico_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_producao_os_loja ON producao_os(loja_id);
CREATE INDEX IF NOT EXISTS idx_producao_os_os ON producao_os(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_producao_os_loja_status_os ON producao_os(loja_id, ordem_servico_id);

-- Trigger atualizado_em
DROP TRIGGER IF EXISTS trg_producao_os_atualizado ON producao_os;
CREATE TRIGGER trg_producao_os_atualizado
  BEFORE UPDATE ON producao_os
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS segunda barreira (padrão V11/V25: fail-closed via app.current_loja_id())
ALTER TABLE producao_os ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_os FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON producao_os;
CREATE POLICY loja_isolation ON producao_os
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

-- Grants (padrão outros módulos)
GRANT SELECT, INSERT, UPDATE, DELETE ON producao_os TO app_api, app_pdv;
GRANT SELECT ON producao_os TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON producao_os TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON producao_os FROM app_readonly;

COMMENT ON TABLE producao_os IS 'Controle de produção técnica (início/fim) e Controle de Qualidade com foto obrigatória em reprovação';
COMMENT ON COLUMN producao_os.inicio_producao IS 'Timestamp de início da produção';
COMMENT ON COLUMN producao_os.fim_producao IS 'Timestamp de fim da produção';
COMMENT ON COLUMN producao_os.cq_aprovado IS 'Resultado do CQ: true aprovado, false reprovado, null pendente';
COMMENT ON COLUMN producao_os.foto_s3_key IS 'Chave objeto S3/MinIO (obrigatória se CQ reprovado)';
COMMENT ON COLUMN producao_os.foto_s3_bucket IS 'Bucket S3/MinIO (opcional, segue padrão Receita)';
COMMENT ON COLUMN producao_os.foto_url IS 'URL da foto (alternativa a s3Key já enviado)';