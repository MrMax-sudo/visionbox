-- V31__seed_categorias_padrao.sql — VisionBox — Categorias Oficiais do Catálogo de Ótica
-- Garante a estrutura e semeia as categorias pré-existentes para todas as lojas.

CREATE TABLE IF NOT EXISTS categoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(500),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_categoria_loja ON categoria(loja_id);
CREATE INDEX IF NOT EXISTS idx_categoria_loja_nome ON categoria(loja_id, nome);

-- Semeia as categorias pré-existentes de ótica em todas as lojas
INSERT INTO categoria (id, loja_id, nome, descricao, ativo, criado_em, atualizado_em, versao)
SELECT gen_random_uuid(), l.id, cat.nome, cat.descricao, true, now(), now(), 0
FROM loja l
CROSS JOIN (VALUES
    ('Armações', 'Armações de grau e receituário'),
    ('Lentes', 'Lentes oftálmicas monofocais e multifocais'),
    ('Óculos de Sol', 'Óculos solares com proteção UV'),
    ('Lentes de Contato', 'Lentes de contato gelatinosas e descartáveis'),
    ('Acessórios', 'Estojos, flanelas, cordões e soluções higienizadoras'),
    ('Serviços', 'Montagem, ajustes, solda e coloração')
) AS cat(nome, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM categoria c 
    WHERE c.loja_id = l.id 
      AND LOWER(c.nome) = LOWER(cat.nome)
);
