-- =============================================================================
-- V4__pedido_venda.sql — pedido_venda + item_pedido  (DRAFT, validar em PG real)
-- Fonte: entidades vendas/domain/PedidoVenda.java (+ ItemPedido aninhada).
-- Obs.: V11 (linhas 119-120) chamava o item de "pedido_venda_item"; a ENTIDADE
-- chama item_pedido. A entidade é a fonte de verdade para o app.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pedido_venda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_venda (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        uuid          NOT NULL REFERENCES loja(id),
  numero         varchar(20)   NOT NULL,
  cliente_id     uuid,
  cliente_nome   varchar(255)  NOT NULL,
  status         varchar(30)   NOT NULL DEFAULT 'CRIADO',
  observacao     varchar(500),
  valor_total    numeric(12,2) NOT NULL DEFAULT 0,
  criado_em      timestamptz   NOT NULL DEFAULT now(),
  atualizado_em  timestamptz   NOT NULL DEFAULT now(),
  versao         bigint        NOT NULL DEFAULT 0,
  ativo          boolean       NOT NULL DEFAULT true,
  CONSTRAINT uk_pedido_venda_loja_numero UNIQUE (loja_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_pedido_venda_loja        ON pedido_venda(loja_id);
CREATE INDEX IF NOT EXISTS idx_pedido_venda_loja_ativo  ON pedido_venda(loja_id) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_pedido_venda_cliente     ON pedido_venda(cliente_id);

DROP TRIGGER IF EXISTS trg_pedido_venda_atualizado ON pedido_venda;
CREATE TRIGGER trg_pedido_venda_atualizado
  BEFORE UPDATE ON pedido_venda FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- -----------------------------------------------------------------------------
-- item_pedido  (entidade aninhada PedidoVenda.ItemPedido)
--   !! NÃO possui loja_id (não estende EntidadeBase) — viola R1.
--      Isolamento hoje é via pedido_id (pai). DECISÃO PENDENTE (README §3.2):
--      aceitar exceção documentada OU adicionar loja_id na entidade (PR).
--   Por isso a RLS dinâmica da V11 NÃO cobre item_pedido automaticamente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_pedido (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid          NOT NULL REFERENCES pedido_venda(id) ON DELETE CASCADE,
  sku             varchar(50)   NOT NULL,
  quantidade      integer       NOT NULL,
  preco_unitario  numeric(12,2) NOT NULL,
  subtotal        numeric(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_pedido_pedido ON item_pedido(pedido_id);