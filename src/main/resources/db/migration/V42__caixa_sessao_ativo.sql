-- V42__caixa_sessao_ativo.sql — correção de contrato entidade × schema
-- A V23 criou caixa_sessao sem a coluna `ativo` do padrão EntidadeBase, e a
-- entidade CaixaSessao aplica @SQLRestriction("ativo = true") — Hibernate
-- validate quebrava no boot ("missing column [ativo] in table [caixa_sessao]",
-- validado em Postgres real 2026-10-13). Aditivo para não alterar o checksum
-- da V23 já aplicada em bancos legados.

ALTER TABLE caixa_sessao ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN caixa_sessao.ativo IS 'Padrão EntidadeBase — soft-delete/@SQLRestriction; false = sessão inativa';
