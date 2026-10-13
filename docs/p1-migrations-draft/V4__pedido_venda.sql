-- =============================================================================
-- V4__pedido_venda.sql — pedido_venda + item_pedido  (DRAFT, validar em PG real)
-- Fonte: entidades vendas/domain/PedidoVenda.java (+ ItemPedido aninhada).
-- =============================================================================
--
-- POSICIONAMENTO (verificado 2026-10-13):
--   A V11 cita 'pedido_venda_item' nas listas explícitas, mas a ENTIDADE mapeia
--   @Table(name = "item_pedido") — a entidade é a fonte de verdade; os nomes da
--   V11 só aparecem em guardas IF EXISTS (tabela inexistente é ignorada).
--   item_pedido fica SEM loja_id (decisão R1 abaixo) e, por isso, FORA da
--   varredura dinâmica da V11 — a policy de isolamento dela nasce AQUI.
--
-- RLS/GRANTS (R1):
--   pedido_venda: RLS+policy+grants são da V11 (posição 11; lista explícita +
--     varredura dinâmica — a tabela tem loja_id). Reproduzir aqui o padrão V25
--     (policy via app.current_loja_id()) é IMPOSSÍVEL: a função só existe a
--     partir da V11. E uma policy com a sintaxe antiga da V2 (current_setting
--     direto) degradaria o banco existente na adoção out-of-order.
--   item_pedido: policy própria (parent-join, bloco abaixo) + grants — a V11
--     NÃO cobre esta tabela (sem coluna loja_id) e não concede grants a ela.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pedido_venda
--   FK cliente_id NÃO criada: a entidade mapeia UUID puro (sem @ManyToOne) —
--   paridade com o schema legado (Hibernate não gera FK). Integridade na
--   camada de serviço (PedidoVendaService).
--   UNIQUE (loja_id, numero) = @Table da entidade. Mantida COMPLETA (não parcial
--   como o SKU da V24): numero é gerado por sequência crescente (VD-YYYY-XXXXX)
--   e nunca reutilizado — o soft-delete não expõe o bug de recriação do SKU.
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
--   !! R1 — loja_id: IMPEDIMENTO TÉCNICO (decisão fechada, README §3.2).
--      A entidade NÃO mapeia loja_id (ItemPedido não estende EntidadeBase).
--      Adicionar loja_id NOT NULL na TABELA sem mudar a entidade QUEBRA o app:
--      Hibernate insere sem a coluna → NULL viola NOT NULL; e com RLS FORCE da
--      varredura da V11, o WITH CHECK (loja_id = ...) rejeitaria todo INSERT.
--      Correção definitiva exige PR backend (ItemPedido com loja_id populado no
--      service) + migration de backfill. Até lá: mitigação DB-layer AQUI.
--   Colunas = exatamente as mapeadas (id, pedido_id, sku, quantidade,
--      preco_unitario, subtotal) — sem criado_em/versao/ativo (não estende
--      EntidadeBase). Hibernate validate: bate 1:1.
--   FK ON DELETE CASCADE: a entidade usa cascade/orphanRemoval em MEMÓRIA
--      (Hibernate não emite CASCADE no DDL sem @OnDelete). CASCADE no banco é
--      hardening para DELETE direto (SQL manual/archival) — não afeta o app.
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

-- Isolamento RLS de item_pedido via pai (não há loja_id na tabela):
--   - NULLIF(...,'') trata string vazia (fail-closed). O helper
--     app.current_loja_id() da V11 NÃO pode ser usado aqui: não existe na
--     posição 4. A V11 não toca item_pedido (sem loja_id) → esta é a policy
--     definitiva da tabela.
--   - Subquery coberta por idx_item_pedido_pedido (FK).
--   - GUC ausente/vazio => NULL => EXISTS falso => 0 linhas (fail-closed).
--   - Owner/superuser (BYPASSRLS) não é afetado — o app atual conecta como
--     owner; a policy passa a valer quando o app assumir as roles app_*.
--   - O subselect em pedido_venda respeita a policy DELE (mesma sessão/GUC):
--     contexto consistente, sem recursividade (tabelas distintas).
ALTER TABLE item_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_pedido FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON item_pedido;
CREATE POLICY loja_isolation ON item_pedido
  FOR ALL TO PUBLIC
  USING (EXISTS (
    SELECT 1 FROM pedido_venda pv
    WHERE pv.id = item_pedido.pedido_id
      AND pv.loja_id = NULLIF(current_setting('app.loja_id', true), '')::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pedido_venda pv
    WHERE pv.id = item_pedido.pedido_id
      AND pv.loja_id = NULLIF(current_setting('app.loja_id', true), '')::uuid
  ));

-- Grants (a V11 não concede nada em item_pedido — sem loja_id, fora das listas)
GRANT SELECT, INSERT, UPDATE, DELETE ON item_pedido TO app_api, app_pdv;
GRANT SELECT ON item_pedido TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON item_pedido TO archival_job;
REVOKE INSERT, UPDATE, DELETE ON item_pedido FROM app_readonly;

COMMENT ON TABLE pedido_venda IS 'Pedido de venda (orçamento/PDV) — loja_id NOT NULL (R1); RLS+policy loja_isolation na V11; número único por loja (sequência crescente, nunca reutilizado)';
COMMENT ON TABLE item_pedido IS 'Itens do pedido — SEM loja_id (impedimento técnico: entidade não estende EntidadeBase; PR backend pendente, README §3.2); isolamento RLS via parent-join pedido_venda.loja_id (policy nesta migration, V11 não cobre)';
