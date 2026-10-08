-- =============================================================================
-- V29__conciliacao_ofx.sql — VisionBox US13 — Conciliação OFX + DRE por OS
-- =============================================================================
-- 1) conciliacao_ofx: linha de extrato OFX importada e seu resultado de
--    conciliação contra conta_receber / conta_pagar da mesma loja.
--    - FITID único por loja (deduplicação de reimportação do mesmo extrato)
--    - status CONCILIADO | DIVERGENTE | PENDENTE (evidência; NÃO dá baixa na conta)
--    - numeric(12,2) HALF_EVEN, timestamptz, loja_id NOT NULL, RLS fail-closed
-- 2) conta_pagar.ordem_servico_id: vínculo opcional conta a pagar <-> OS para
--    permitir DRE por OS (custo por OS). conta_receber já possui o vínculo (V15).
--
-- Padrão RLS: idêntico a V11 (helper app.current_loja_id()) e V17/V25
-- (ENABLE + FORCE + POLICY loja_isolation + grants por role).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabela conciliacao_ofx
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conciliacao_ofx (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    fit_id VARCHAR(100) NOT NULL,
    trn_tipo VARCHAR(20),
    data_postamento DATE NOT NULL,
    valor NUMERIC(12,2) NOT NULL,
    memo VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('CONCILIADO','DIVERGENTE','PENDENTE')),
    tipo_conta VARCHAR(10) CHECK (tipo_conta IS NULL OR tipo_conta IN ('RECEBER','PAGAR')),
    conta_receber_id UUID REFERENCES conta_receber(id) ON DELETE SET NULL,
    conta_pagar_id UUID REFERENCES conta_pagar(id) ON DELETE SET NULL,
    diferenca_valor NUMERIC(12,2),
    observacao VARCHAR(300),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    -- Deduplicação: o mesmo FITID nunca entra duas vezes para a mesma loja
    CONSTRAINT uq_conciliacao_ofx_loja_fit UNIQUE (loja_id, fit_id)
);

COMMENT ON TABLE conciliacao_ofx IS
    'US13 conciliação OFX — linha de extrato importada. Não altera status da conta (evidência). Dedup por (loja_id, fit_id).';
COMMENT ON COLUMN conciliacao_ofx.fit_id IS
    'ID de transação do banco (OFX FITID). Único por loja. Sem FITID no arquivo, gerado AUTO-<sha256> determinístico.';
COMMENT ON COLUMN conciliacao_ofx.status IS
    'CONCILIADO = valor+data dentro da tolerância; DIVERGENTE = candidato com divergência de valor/data; PENDENTE = sem correspondência.';
COMMENT ON COLUMN conciliacao_ofx.diferenca_valor IS
    'Divergência: valor do extrato (abs) - valor da conta, HALF_EVEN 2 casas. Nulo quando PENDENTE/CONCILIADO.';

CREATE INDEX IF NOT EXISTS idx_conciliacao_ofx_loja_data ON conciliacao_ofx(loja_id, data_postamento);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ofx_loja_status ON conciliacao_ofx(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ofx_loja_data_status ON conciliacao_ofx(loja_id, status, data_postamento);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ofx_conta_receber ON conciliacao_ofx(loja_id, conta_receber_id) WHERE conta_receber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conciliacao_ofx_conta_pagar ON conciliacao_ofx(loja_id, conta_pagar_id) WHERE conta_pagar_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_conciliacao_ofx_atualizado ON conciliacao_ofx;
CREATE TRIGGER trg_conciliacao_ofx_atualizado
  BEFORE UPDATE ON conciliacao_ofx
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS fail-closed (padrão V11/V17/V25)
ALTER TABLE conciliacao_ofx ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacao_ofx FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON conciliacao_ofx;
CREATE POLICY loja_isolation ON conciliacao_ofx
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

COMMENT ON POLICY loja_isolation ON conciliacao_ofx IS
    'ADR-001 isolamento tenant: USING/WITH CHECK loja_id = app.current_loja_id() (fail-closed). SET LOCAL app.loja_id via TenantStatementInspector.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON conciliacao_ofx TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON conciliacao_ofx TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON conciliacao_ofx TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON conciliacao_ofx FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2) conta_pagar.ordem_servico_id — custo por OS (DRE por OS)
--    Conta a pagar de custo direto de OS (ex.: laboratório) passa a apontar
--    para a OS. Opcional: contas antigas/fornecedor geral ficam NULL.
-- ---------------------------------------------------------------------------
ALTER TABLE conta_pagar
    ADD COLUMN IF NOT EXISTS ordem_servico_id UUID REFERENCES ordem_servico(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conta_pagar_os ON conta_pagar(ordem_servico_id) WHERE ordem_servico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conta_pagar_loja_os_vencimento ON conta_pagar(loja_id, ordem_servico_id, vencimento) WHERE ordem_servico_id IS NOT NULL;

COMMENT ON COLUMN conta_pagar.ordem_servico_id IS
    'US13 DRE por OS — vínculo opcional da conta a pagar com ordem_servico (custo direto da OS). NULL = custo geral da loja.';
