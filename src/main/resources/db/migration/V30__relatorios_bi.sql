-- V30__relatorios_bi.sql — VisionBox US16 BI (giro de produtos, margem por vendedor, curva ABC)
-- =============================================================================
-- Escopo: SOMENTE índices de suporte dos relatórios agregados.
--
-- NENHUMA tabela/view nova aqui, por decisão deliberada (ADR-006):
--   * evita view porque uma view criada pelo owner (superuser) ignora RLS das
--     tabelas base (o owner é BYPASSRLS) e poderia vazar dados entre lojas —
--     a segunda barreira ADR-001 (RLS FORCE + policy loja_isolation) só vale
--     se a leitura passar pelas tabelas base com loja_id como filtro.
--   * as queries agregadas filtram SEMPRE por loja_id (parâmetro explícito do
--     repositório de relatorios) + SET LOCAL app.loja_id do TenantStatementInspector.
--
-- Cobertura RLS/Grants: as tabelas envolvidas (ordem_servico, evento_os,
-- conta_receber, produto) já são RLS FORCE + policy loja_isolation + grants
-- desde V11/V15/V18 — nada a adicionar aqui.
-- =============================================================================

-- Índice de período+status para giro-produtos / margem-vendedor / curva-abc:
-- todas leem ordem_servico filtrando (loja_id) + range criado_em + exclusão de
-- CANCELADO/DEVOLVIDO_GARANTIA. Loja_id lidera o índice (ADR-001).
CREATE INDEX IF NOT EXISTS idx_os_bi_loja_status_criado
    ON ordem_servico (loja_id, status, criado_em DESC);

-- Margem-vendedor soma conta_receber por OS não cancelada — o índice existente
-- idx_conta_receber_os cobre (ordem_servico_id); este parcial já exclui títulos
-- cancelados/inativos no próprio índice, evitando a varredura do filtro.
CREATE INDEX IF NOT EXISTS idx_conta_receber_bi_os_nao_cancelado
    ON conta_receber (ordem_servico_id)
    WHERE ativo = true AND status <> 'CANCELADO';

COMMENT ON INDEX idx_os_bi_loja_status_criado IS
    'US16 BI: varredura por (loja_id, status, criado_em) de ordem_servico para giro-produtos, margem-vendedor e curva-abc no período.';

COMMENT ON INDEX idx_conta_receber_bi_os_nao_cancelado IS
    'US16 BI: agregação de receita por OS (ordem_servico_id) considerando só contas ativas e não canceladas (margem-vendedor).';