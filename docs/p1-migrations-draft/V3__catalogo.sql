-- =============================================================================
-- V3__catalogo.sql — produto + marca + categoria  (DRAFT, validar em PG real)
-- Fonte de verdade: entidades catalogo/domain/{Produto,Marca,Categoria}.java
-- + EntidadeBase (id, loja_id, timestamptz, versao, ativo).
-- Originalmente criadas "fora do Flyway" (comentário V24). Aqui reconstruídas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- marca
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marca (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        uuid         NOT NULL REFERENCES loja(id),
  nome           varchar(100) NOT NULL,
  descricao      varchar(500),
  criado_em      timestamptz  NOT NULL DEFAULT now(),
  atualizado_em  timestamptz  NOT NULL DEFAULT now(),
  versao         bigint       NOT NULL DEFAULT 0,
  ativo          boolean      NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_marca_loja      ON marca(loja_id);
CREATE INDEX IF NOT EXISTS idx_marca_loja_nome ON marca(loja_id, nome);

-- -----------------------------------------------------------------------------
-- categoria
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        uuid         NOT NULL REFERENCES loja(id),
  nome           varchar(100) NOT NULL,
  descricao      varchar(500),
  criado_em      timestamptz  NOT NULL DEFAULT now(),
  atualizado_em  timestamptz  NOT NULL DEFAULT now(),
  versao         bigint       NOT NULL DEFAULT 0,
  ativo          boolean      NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_categoria_loja      ON categoria(loja_id);
CREATE INDEX IF NOT EXISTS idx_categoria_loja_nome ON categoria(loja_id, nome);

-- -----------------------------------------------------------------------------
-- produto  (single-table Armacao/Lente/Acessorio/Servico)
--   Inclui colunas fiscais (ncm/cest/cfop/cbenef) — a V18 fica no-op.
--   Unicidade de SKU é PARCIAL (WHERE ativo = true) por causa do soft-delete
--   (ver V24). Usamos o mesmo nome de índice que a V24 espera.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produto (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id             uuid          NOT NULL REFERENCES loja(id),
  sku                 varchar(50)   NOT NULL,
  codigo_barras       varchar(50),
  nome                varchar(200)  NOT NULL,
  descricao           varchar(1000),
  tipo_produto        varchar(30)   NOT NULL DEFAULT 'ARMACAO'
                      CHECK (tipo_produto IN ('ARMACAO','LENTE','LENTE_CONTATO','ACESSORIO','SERVICO')),
  marca_id            uuid,
  categoria_id        uuid,
  marca               varchar(100),   -- desnormalizado
  categoria           varchar(100),   -- desnormalizado
  ncm                 varchar(8),
  cest                varchar(7),
  cfop                varchar(4),
  cbenef              varchar(10),
  custo               numeric(12,2) NOT NULL,
  preco_venda         numeric(12,2) NOT NULL,
  estoque_quantidade  integer       NOT NULL DEFAULT 0,
  estoque_reservado   integer       NOT NULL DEFAULT 0,
  ativo_venda         boolean       NOT NULL DEFAULT true,
  criado_em           timestamptz   NOT NULL DEFAULT now(),
  atualizado_em       timestamptz   NOT NULL DEFAULT now(),
  versao              bigint        NOT NULL DEFAULT 0,
  ativo               boolean       NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_produto_loja        ON produto(loja_id);
CREATE INDEX IF NOT EXISTS idx_produto_loja_ativo  ON produto(loja_id) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_produto_loja_tipo   ON produto(loja_id, tipo_produto);
CREATE INDEX IF NOT EXISTS idx_produto_loja_nome   ON produto(loja_id, nome);
-- Unicidade de SKU apenas entre ativos (mesmo nome/estratégia da V24)
CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_loja_sku_ativo ON produto(loja_id, sku) WHERE ativo = true;

-- Trigger de atualizado_em (padrão do projeto)
DROP TRIGGER IF EXISTS trg_produto_atualizado ON produto;
CREATE TRIGGER trg_produto_atualizado
  BEFORE UPDATE ON produto FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

DROP TRIGGER IF EXISTS trg_marca_atualizado ON marca;
CREATE TRIGGER trg_marca_atualizado
  BEFORE UPDATE ON marca FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

DROP TRIGGER IF EXISTS trg_categoria_atualizado ON categoria;
CREATE TRIGGER trg_categoria_atualizado
  BEFORE UPDATE ON categoria FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

COMMENT ON TABLE produto IS 'Catálogo single-table (Armacao/Lente/...) — RLS por loja_id (V11); SKU único só entre ativos';