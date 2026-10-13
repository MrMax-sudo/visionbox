-- V35__compras_maquininha_comissao.sql — Fase 4 Robustez: Compras (XML NF-e), Maquininhas MDR e Comissões
-- Referência canônica: docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md §3.4 (Compras XML), §3.5 (MDR),
-- §3.6 (Comissões) + Outbox ERP (Compra, CompraItem, MaquininhaCartao, ComissaoConfig, ComissaoLancamento)
-- Conteúdo:
--   1) compra + compra_item        — cabeçalho/itens da NF-e de entrada (importação XML)
--   2) maquininha_cartao           — taxas MDR por adquirente/faixa (débito, crédito 1x, 2-6x, 7-12x)
--   3) comissao_config             — regra de comissão GERAL ou por CATEGORIA de produto
--   4) comissao_lancamento         — apuração por venda/vendedor (idempotente por venda)
-- Multi-tenant: loja_id NOT NULL + timestamptz + numeric(12,2) + RLS FORCE fail-closed (R1/ADR-001)
-- Sem FK para produto/pedido_venda/usuario de propósito: essas tabelas podem faltar em bancos
-- afetados por D-005 (V3-V10 ausentes) — mesmo padrão de estoque.produto_id (UUID solto).

-- ==========================================================================
-- 1) compra + compra_item — entrada de NF-e de fornecedor (§3.4)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS compra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    numero VARCHAR(50) NOT NULL,
    serie VARCHAR(10),
    chave_acesso VARCHAR(44),
    data_emissao DATE NOT NULL,
    fornecedor_nome VARCHAR(200) NOT NULL,
    fornecedor_cnpj VARCHAR(14),
    valor_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_subtotal >= 0),
    desconto NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
    frete NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (frete >= 0),
    valor_total NUMERIC(12,2) NOT NULL CHECK (valor_total >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'IMPORTADA'
        CHECK (status IN ('IMPORTADA', 'CONFIRMADA', 'CANCELADA')),
    xml_fiscal TEXT,
    usuario_id UUID,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

-- Idempotência da importação: uma NF-e (chave de 44 dígitos) entra uma vez por loja.
CREATE UNIQUE INDEX IF NOT EXISTS uk_compra_loja_chave
    ON compra(loja_id, chave_acesso) WHERE chave_acesso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compra_loja_emissao ON compra(loja_id, data_emissao);
CREATE INDEX IF NOT EXISTS idx_compra_loja_criado ON compra(loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_compra_loja_fornecedor ON compra(loja_id, fornecedor_nome);

DROP TRIGGER IF EXISTS trg_compra_atualizado ON compra;
CREATE TRIGGER trg_compra_atualizado
  BEFORE UPDATE ON compra
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON compra;
CREATE POLICY loja_isolation ON compra
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON compra TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON compra TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON compra TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON compra FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE compra IS 'Compra de fornecedor a partir de XML NF-e de entrada (§3.4). Emissão é do Flowbox — aqui só se consome XML (R3).';
COMMENT ON COLUMN compra.chave_acesso IS 'Chave de acesso NF-e (44 dígitos) — dedup da importação por loja (índice único parcial).';
COMMENT ON COLUMN compra.usuario_id IS 'Usuário que importou (deriva do JWT, sem FK — padrão conta_receber_pagamento.usuario_id).';
COMMENT ON COLUMN compra.fornecedor_cnpj IS 'CNPJ jurídico do emitente da nota (dado fiscal da NF-e, não é CPF pessoal) — sinalizado ao security-auditor.';

CREATE TABLE IF NOT EXISTS compra_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    compra_id UUID NOT NULL REFERENCES compra(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    ncm VARCHAR(8),
    ean VARCHAR(50),
    codigo_fornecedor VARCHAR(50),
    unidade VARCHAR(6),
    quantidade NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
    custo_unitario NUMERIC(12,2) NOT NULL CHECK (custo_unitario >= 0),
    valor_total NUMERIC(12,2) NOT NULL CHECK (valor_total >= 0),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_compra_item_compra ON compra_item(compra_id);
CREATE INDEX IF NOT EXISTS idx_compra_item_loja_produto ON compra_item(loja_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_compra_item_loja_ean ON compra_item(loja_id, ean) WHERE ean IS NOT NULL;

DROP TRIGGER IF EXISTS trg_compra_item_atualizado ON compra_item;
CREATE TRIGGER trg_compra_item_atualizado
  BEFORE UPDATE ON compra_item
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE compra_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_item FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON compra_item;
CREATE POLICY loja_isolation ON compra_item
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON compra_item TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON compra_item TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON compra_item TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON compra_item FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE compra_item IS 'Item da NF-e de entrada (§3.4): descrição, NCM, EAN, qtd e custo extraídos do XML; produto_id resolvido por de-para EAN/SKU ou pré-cadastro automático.';
COMMENT ON COLUMN compra_item.produto_id IS 'UUID do produto do catálogo — sem FK (mesmo padrão de estoque.produto_id, D-005).';

-- ==========================================================================
-- 2) maquininha_cartao — taxas MDR (§3.5)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS maquininha_cartao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    nome VARCHAR(100) NOT NULL,
    adquirente VARCHAR(50) NOT NULL,
    debito_taxa_percentual NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (debito_taxa_percentual >= 0),
    debito_taxa_fixa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debito_taxa_fixa >= 0),
    credito_1x_taxa_percentual NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (credito_1x_taxa_percentual >= 0),
    credito_1x_taxa_fixa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_1x_taxa_fixa >= 0),
    credito_2_6_taxa_percentual NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (credito_2_6_taxa_percentual >= 0),
    credito_2_6_taxa_fixa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_2_6_taxa_fixa >= 0),
    credito_7_12_taxa_percentual NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (credito_7_12_taxa_percentual >= 0),
    credito_7_12_taxa_fixa NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credito_7_12_taxa_fixa >= 0),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_maquininha_cartao_loja_ativo ON maquininha_cartao(loja_id, ativo);

DROP TRIGGER IF EXISTS trg_maquininha_cartao_atualizado ON maquininha_cartao;
CREATE TRIGGER trg_maquininha_cartao_atualizado
  BEFORE UPDATE ON maquininha_cartao
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE maquininha_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquininha_cartao FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON maquininha_cartao;
CREATE POLICY loja_isolation ON maquininha_cartao
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON maquininha_cartao TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON maquininha_cartao TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON maquininha_cartao TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON maquininha_cartao FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE maquininha_cartao IS 'Maquininha/POS com taxas MDR (§3.5): taxaValor = valor * (taxaPercentual/100) + taxaFixa; liquido = valor - taxaValor. Débito é à vista; crédito por faixa 1x / 2-6x / 7-12x.';

-- ==========================================================================
-- 3) comissao_config — regra GERAL ou por CATEGORIA (§3.6)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS comissao_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('GERAL', 'CATEGORIA')),
    categoria VARCHAR(100),
    percentual NUMERIC(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_comissao_config_categoria_obrigatoria CHECK (tipo = 'GERAL' OR categoria IS NOT NULL)
);

-- Uma regra GERAL ativa por loja; uma regra por categoria ativa por loja (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS uk_comissao_config_geral
    ON comissao_config(loja_id) WHERE tipo = 'GERAL' AND ativo = true;
CREATE UNIQUE INDEX IF NOT EXISTS uk_comissao_config_categoria
    ON comissao_config(loja_id, lower(categoria)) WHERE tipo = 'CATEGORIA' AND ativo = true;
CREATE INDEX IF NOT EXISTS idx_comissao_config_loja_ativo ON comissao_config(loja_id, ativo);

DROP TRIGGER IF EXISTS trg_comissao_config_atualizado ON comissao_config;
CREATE TRIGGER trg_comissao_config_atualizado
  BEFORE UPDATE ON comissao_config
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE comissao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissao_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON comissao_config;
CREATE POLICY loja_isolation ON comissao_config
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON comissao_config TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON comissao_config TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON comissao_config TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON comissao_config FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE comissao_config IS 'Regra de comissão (§3.6): GERAL sobre total da venda ou CATEGORIA sobre itens da categoria. Base da GERAL exclui bases já cobertas por regra de categoria (sem dupla cobrança).';

-- ==========================================================================
-- 4) comissao_lancamento — apuração por venda/vendedor (§3.6)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS comissao_lancamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    venda_id UUID,
    venda_numero VARCHAR(30),
    vendedor_id UUID NOT NULL,
    vendedor_nome VARCHAR(150),
    categoria VARCHAR(100),
    base_calculo NUMERIC(12,2) NOT NULL CHECK (base_calculo >= 0),
    percentual_aplicado NUMERIC(5,2) NOT NULL CHECK (percentual_aplicado >= 0 AND percentual_aplicado <= 100),
    valor_comissao NUMERIC(12,2) NOT NULL CHECK (valor_comissao >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    data_lancamento TIMESTAMPTZ NOT NULL DEFAULT now(),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0
);

-- Idempotência da apuração (R4): uma venda + vendedor + base (categoria ou total) apura uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS uk_comissao_lancamento_venda
    ON comissao_lancamento(loja_id, venda_id, vendedor_id, coalesce(categoria, ''))
    WHERE venda_id IS NOT NULL AND ativo = true;
CREATE INDEX IF NOT EXISTS idx_comissao_lancamento_loja_data ON comissao_lancamento(loja_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_comissao_lancamento_loja_vendedor_data
    ON comissao_lancamento(loja_id, vendedor_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_comissao_lancamento_venda ON comissao_lancamento(loja_id, venda_id) WHERE venda_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_comissao_lancamento_atualizado ON comissao_lancamento;
CREATE TRIGGER trg_comissao_lancamento_atualizado
  BEFORE UPDATE ON comissao_lancamento
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE comissao_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissao_lancamento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON comissao_lancamento;
CREATE POLICY loja_isolation ON comissao_lancamento
  FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON comissao_lancamento TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON comissao_lancamento TO app_readonly';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON comissao_lancamento TO archival_job';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON comissao_lancamento FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE comissao_lancamento IS 'Apuração de comissão (§3.6) — vinculada à venda e ao vendedor/usuario. categoria nula = base GERAL. Sem FK para pedido_venda/usuario (D-005).';
COMMENT ON COLUMN comissao_lancamento.vendedor_id IS 'Vendedor/usuario responsável (deriva do JWT ou do payload de apuração) — sem FK.';
