-- V15__produto_fiscal.sql — VisionBox Fiscal Produto + tributacao_regra
-- Dev usa ddl-auto=create (Hibernate cria campos automaticamente); este arquivo é para prod Flyway validate.
-- Mantém idempotência com IF NOT EXISTS / ON CONFLICT e replica comentários para auditoria.

-- =============================================================
-- 1) Produto — campos fiscais NCM(8) CEST(7) CFOP(4) cBenef
-- =============================================================
-- Produto já existe via Hibernate (V5 single-table). Garantir colunas caso Flyway validate em prod limpo:
-- Usar informação de coluna para não quebrar se tabela ainda não existir (dev com ddl-auto)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produto') THEN
    -- ncm 8 dígitos (ex: 90031100 armação, 90015000 lente)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produto' AND column_name='ncm') THEN
      ALTER TABLE produto ADD COLUMN ncm VARCHAR(8);
    END IF;
    -- cest 7 dígitos (ex: 2805300 para armações)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produto' AND column_name='cest') THEN
      ALTER TABLE produto ADD COLUMN cest VARCHAR(7);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produto' AND column_name='cfop') THEN
      ALTER TABLE produto ADD COLUMN cfop VARCHAR(4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produto' AND column_name='cbenef') THEN
      ALTER TABLE produto ADD COLUMN cbenef VARCHAR(10);
    END IF;

    -- Comentários para documentação (NCM 9003/9004 validação em ProdutoService.validarNcm)
    COMMENT ON COLUMN produto.ncm IS 'NCM 8 dígitos — ótica: 9003 armações (90031100) / 9001 lentes (90015000) / 9004 óculos. Validação: ProdutoService.validarNcm aceita 9003/9004/9001. Nunca hard-code alíquota.';
    COMMENT ON COLUMN produto.cest IS 'CEST 7 dígitos — ex 2805300 armação plástico. Validação 7 numéricos.';
    COMMENT ON COLUMN produto.cfop IS 'CFOP 4 dígitos — 5102 venda dentro UF, 5405 venda ST, 6102 venda fora UF. Validação 4 numéricos.';
    COMMENT ON COLUMN produto.cbenef IS 'Código benefício fiscal UF (cBenef) — até 10 alfanumérico. Ex: SP123456.';
  END IF;
END
$$;

-- Índices para busca fiscal (NCM + CEST usados em tributacao_regra)
CREATE INDEX IF NOT EXISTS idx_produto_ncm ON produto(ncm) WHERE ncm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produto_cest ON produto(cest) WHERE cest IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produto_cfop ON produto(cfop) WHERE cfop IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produto_loja_ncm ON produto(loja_id, ncm) WHERE ncm IS NOT NULL;

-- =============================================================
-- 2) tributacao_regra — tabela parametrizável NCM+UF+CRT
-- =============================================================
-- Nunca hard-code alíquota (PROJECT_CONTEXT.md:87). Toda tributação vem de tributacao_regra.
-- Seed MVP cobre NCMs 90031100 e 90015000 CRT 1 Simples CSOSN 102 — ótica típica sem ST.

CREATE TABLE IF NOT EXISTS tributacao_regra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    uf_origem VARCHAR(2),
    uf_destino VARCHAR(2),
    ncm VARCHAR(8) NOT NULL CHECK (ncm ~ '^\d{8}$'),
    crt VARCHAR(1) NOT NULL CHECK (crt IN ('1','2','3')),
    cfop VARCHAR(4) CHECK (cfop ~ '^\d{4}$'),
    csosn VARCHAR(3), -- 102, 500, 400 para Simples
    cst VARCHAR(3),   -- 00, 40, 60 para Normal
    aliquota NUMERIC(5,2),
    cbenef VARCHAR(10),
    descricao VARCHAR(500),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_tributacao_ncm_crt_uf_cfop UNIQUE (loja_id, ncm, crt, uf_origem, cfop)
);

CREATE INDEX IF NOT EXISTS idx_tributacao_loja_ncm ON tributacao_regra(loja_id, ncm);
CREATE INDEX IF NOT EXISTS idx_tributacao_loja_ncm_crt ON tributacao_regra(loja_id, ncm, crt);
CREATE INDEX IF NOT EXISTS idx_tributacao_uf ON tributacao_regra(uf_origem, uf_destino) WHERE uf_origem IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tributacao_crt_csosn ON tributacao_regra(crt, csosn);

DROP TRIGGER IF EXISTS trg_tributacao_regra_atualizado ON tributacao_regra;
CREATE TRIGGER trg_tributacao_regra_atualizado
  BEFORE UPDATE ON tributacao_regra
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

COMMENT ON TABLE tributacao_regra IS 'Parametrização tributária NCM+UF+CRT — nunca hard-code alíquota. CRT 1 → CSOSN 102/500/400, CRT 3 → CST 00/40/60. Seed 90031100/90015000 CRT 1 CSOSN 102.';
COMMENT ON COLUMN tributacao_regra.ncm IS 'NCM 8 dígitos — 90031100 armação, 90015000 lente oftálmica';
COMMENT ON COLUMN tributacao_regra.crt IS 'Código Regime Tributário: 1 Simples Nacional, 2 Simples excesso sublimite, 3 Regime Normal (Lucro Presumido/Real)';
COMMENT ON COLUMN tributacao_regra.csosn IS 'CSOSN para CRT 1 — 102 tributada Simples sem perm crédito, 500 ICMS cobrado ST, 400 não tributada';
COMMENT ON COLUMN tributacao_regra.cst IS 'CST para CRT 3 — 00 tributada integral, 40 isenta, 60 ICMS cobrado ST';
COMMENT ON COLUMN tributacao_regra.cfop IS 'CFOP padrão da operação — 5102 venda, 5405 venda ST';

-- RLS para isolamento multi-tenant (mesma regra das demais tabelas com loja_id)
ALTER TABLE tributacao_regra ENABLE ROW LEVEL SECURITY;
ALTER TABLE tributacao_regra FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON tributacao_regra;
CREATE POLICY loja_isolation ON tributacao_regra
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT ON tributacao_regra TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON tributacao_regra TO app_api, app_pdv, archival_job;
REVOKE INSERT, UPDATE, DELETE ON tributacao_regra FROM app_readonly;

-- =============================================================
-- 3) Seeds — CRT 1 Simples CSOSN 102 para NCMs óticos
--    Loja Matriz dev (00000000-0000-0000-0000-000000000001)
--    CFOP 5102 (venda dentro do estado) — mais comum ótica varejo
--    Divergência entre UF: ST não se aplica a 9003/9004 no varejo ótico SP/RJ/MG → CSOSN 102 uniforme
--    UF origem genérica NULL = aplica para qualquer UF; também seed SP explícito para garantir
-- =============================================================
-- Helpers: garante loja matriz existe (idempotente)
INSERT INTO loja (id, nome, cnpj) VALUES ('00000000-0000-0000-0000-000000000001', 'VisionBox Matriz', '00000000000191')
ON CONFLICT (id) DO NOTHING;

-- Seed 90031100 armação — CRT 1 CSOSN 102 CFOP 5102 (SP origem)
INSERT INTO tributacao_regra (id, loja_id, uf_origem, uf_destino, ncm, crt, cfop, csosn, cst, aliquota, descricao)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'SP', NULL, '90031100', '1', '5102', '102', NULL, 0.00, 'Armação plástico 90031100 — Simples Nacional CRT 1 CSOSN 102 (tributado sem permissão crédito) — sem ST ótica varejo'
WHERE NOT EXISTS (SELECT 1 FROM tributacao_regra WHERE loja_id='00000000-0000-0000-0000-000000000001' AND ncm='90031100' AND crt='1' AND COALESCE(uf_origem,'*')='SP' AND cfop='5102');

INSERT INTO tributacao_regra (id, loja_id, uf_origem, uf_destino, ncm, crt, cfop, csosn, cst, aliquota, descricao)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, NULL, NULL, '90031100', '1', '5102', '102', NULL, 0.00, 'Armação plástico 90031100 — regra genérica UF — Simples CRT 1 CSOSN 102'
WHERE NOT EXISTS (SELECT 1 FROM tributacao_regra WHERE loja_id='00000000-0000-0000-0000-000000000001' AND ncm='90031100' AND crt='1' AND uf_origem IS NULL AND cfop='5102');

-- Seed 90015000 lente oftálmica — CRT 1 CSOSN 102 CFOP 5102
INSERT INTO tributacao_regra (id, loja_id, uf_origem, uf_destino, ncm, crt, cfop, csosn, cst, aliquota, descricao)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'SP', NULL, '90015000', '1', '5102', '102', NULL, 0.00, 'Lente oftálmica 90015000 — Simples Nacional CRT 1 CSOSN 102 — sem ST'
WHERE NOT EXISTS (SELECT 1 FROM tributacao_regra WHERE loja_id='00000000-0000-0000-0000-000000000001' AND ncm='90015000' AND crt='1' AND COALESCE(uf_origem,'*')='SP' AND cfop='5102');

INSERT INTO tributacao_regra (id, loja_id, uf_origem, uf_destino, ncm, crt, cfop, csosn, cst, aliquota, descricao)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, NULL, NULL, '90015000', '1', '5102', '102', NULL, 0.00, 'Lente oftálmica 90015000 — regra genérica UF — Simples CRT 1 CSOSN 102'
WHERE NOT EXISTS (SELECT 1 FROM tributacao_regra WHERE loja_id='00000000-0000-0000-0000-000000000001' AND ncm='90015000' AND crt='1' AND uf_origem IS NULL AND cfop='5102');

-- CFOP 5405 adicional (venda com ST) para armação, também CSOSN 500 para Simples quando há ST (divergência MG cobra)
INSERT INTO tributacao_regra (id, loja_id, uf_origem, uf_destino, ncm, crt, cfop, csosn, cst, aliquota, descricao)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'MG', NULL, '90031100', '1', '5405', '500', NULL, 0.00, 'Armação 90031100 MG — Simples ST — CSOSN 500 ICMS cobrado anteriormente por ST'
WHERE NOT EXISTS (SELECT 1 FROM tributacao_regra WHERE loja_id='00000000-0000-0000-0000-000000000001' AND ncm='90031100' AND crt='1' AND uf_origem='MG' AND cfop='5405');

-- Log validação
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM tributacao_regra WHERE loja_id='00000000-0000-0000-0000-000000000001' AND ncm IN ('90031100','90015000') AND crt='1' AND csosn='102';
  RAISE NOTICE 'V15 tributacao_regra seed: % registros CSOSN 102 para 90031100/90015000 CRT 1', cnt;
END
$$;
