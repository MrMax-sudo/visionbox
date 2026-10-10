-- =============================================================================
-- V5__ordem_servico_colunas.sql — colunas de vínculo em ordem_servico (DRAFT)
-- A V1 criou ordem_servico SEM cliente/receita/armacao/lente/laboratorio.
-- A entidade OrdemServico e o RelatorioBiRepository (JOIN produto em armacao_id/
-- lente_id) exigem estas colunas. Reconstrução do schema legado.
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS cliente_id    uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS receita_id    uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS armacao_id    uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS lente_id      uuid;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS laboratorio_id uuid;

-- Índices de apoio ao BI (V30) e às consultas por cliente
CREATE INDEX IF NOT EXISTS idx_os_loja_cliente   ON ordem_servico(loja_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_armacao        ON ordem_servico(armacao_id) WHERE armacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_lente          ON ordem_servico(lente_id)   WHERE lente_id IS NOT NULL;

-- FKs são OPCIONAIS (o schema legado não as tinha). Descomentar se o db-admin
-- confirmar integridade referencial desejada:
-- ALTER TABLE ordem_servico ADD CONSTRAINT fk_os_cliente   FOREIGN KEY (cliente_id)   REFERENCES cliente(id);
-- ALTER TABLE ordem_servico ADD CONSTRAINT fk_os_receita   FOREIGN KEY (receita_id)   REFERENCES receita(id);
-- ALTER TABLE ordem_servico ADD CONSTRAINT fk_os_armacao   FOREIGN KEY (armacao_id)   REFERENCES produto(id);
-- ALTER TABLE ordem_servico ADD CONSTRAINT fk_os_lente     FOREIGN KEY (lente_id)     REFERENCES produto(id);