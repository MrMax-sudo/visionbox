-- =============================================================================
-- V5__ordem_servico_colunas.sql — colunas de vínculo em ordem_servico (DRAFT)
-- A V1 criou ordem_servico SEM cliente/receita/armacao/lente/laboratorio.
-- A entidade OrdemServico (@Column cliente_id nullable=false; receita_id/
-- armacao_id/lente_id/laboratorio_id nullable) e o RelatorioBiRepository
-- (JOIN produto pr ON pr.id = os.armacao_id/lente_id — RelatorioBiRepository:118-121)
-- exigem estas colunas. Reconstrução do schema legado.
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- cliente_id NOT NULL = @Column(nullable=false) da entidade.
--   Banco LIMPO: ordem_servico está vazia na posição 5 (seeds só na V14/V22,
--   nenhuma migration anterior insere OS) → SET NOT NULL é instantâneo.
--   Banco LEGADO: coluna já existe NOT NULL (schema criado pelo Hibernate a
--   partir da entidade) → ADD IF NOT EXISTS e SET NOT NULL = no-ops.
--   Se um banco intermediário tiver NULLs, o SET NOT NULL falha RUIDOSAMENTE —
--   intencional: dado órfão exige backfill antes de fechar a constraint.
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS cliente_id    uuid;
ALTER TABLE ordem_servico ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS receita_id    uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS armacao_id    uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS lente_id      uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS laboratorio_id uuid;

-- Índices de apoio ao BI (V30) e às consultas por cliente
CREATE INDEX IF NOT EXISTS idx_os_loja_cliente   ON ordem_servico(loja_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_armacao        ON ordem_servico(armacao_id) WHERE armacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_lente          ON ordem_servico(lente_id)   WHERE lente_id IS NOT NULL;

-- FKs: DECISÃO FECHADA = NÃO criar. A entidade OrdemServico mapeia UUIDs puros
-- (sem @ManyToOne) — o schema legado (Hibernate ddl-auto) NÃO tem essas FKs, e o
-- RelatorioBiRepository faz JOIN por armacao_id/lente_id sem depender de FK
-- (LEFT JOIN tolerante a produto removido). Integridade referencial fica na
-- camada de serviço (OrdemServicoService valida cliente/produto por loja_id).
-- Alternativa descartada (mantida aqui para registro): FKs para
-- cliente(id)/receita(id)/produto(id) exigiriam revisão de dados do legado e
-- divergiriam do schema que o validate do Hibernate aceita hoje.
--
-- Lock analysis: CREATE INDEX toma ShareLock (bloqueia writes na OS) — tabelas
-- de ótica são pequenas (<100k linhas típico) → janela <1s. Se um banco legado
-- grande for adotar, criar os índices ANTES manualmente com CREATE INDEX
-- CONCURRENTLY (incompatível com a transação do Flyway) e deixar os IF NOT
-- EXISTS desta migration no-op-á-los.