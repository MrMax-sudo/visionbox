-- V52__tabela_orcamento.sql — VisionBox — Módulo Oficial de Orçamentos
CREATE TABLE IF NOT EXISTS orcamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL,
    numero VARCHAR(30) NOT NULL,
    cliente_id UUID,
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_cpf VARCHAR(20),
    cliente_telefone VARCHAR(30),
    vendedor_id UUID,
    vendedor_nome VARCHAR(150),
    valor_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    desconto NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    valor_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    validade_dias INT NOT NULL DEFAULT 15,
    status VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
    observacoes TEXT,
    condicoes_pagamento VARCHAR(255),
    venda_id UUID,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_orcamento_loja_numero UNIQUE (loja_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_loja_status ON orcamento(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_orcamento_loja_cliente ON orcamento(loja_id, cliente_nome);
CREATE INDEX IF NOT EXISTS idx_orcamento_loja_criado ON orcamento(loja_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS orcamento_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL,
    orcamento_id UUID NOT NULL REFERENCES orcamento(id) ON DELETE CASCADE,
    produto_id UUID,
    sku VARCHAR(60),
    descricao VARCHAR(255) NOT NULL,
    quantidade NUMERIC(10,2) NOT NULL DEFAULT 1.00,
    preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    desconto NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_item_orcamento ON orcamento_item(orcamento_id);

COMMENT ON TABLE orcamento IS 'Orçamentos comerciais gerados no PDV ou no módulo de vendas';
COMMENT ON TABLE orcamento_item IS 'Itens e produtos vinculados ao orçamento comercial';
