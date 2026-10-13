-- V44__contrato_loja_flowbox_os_pagamento_ativo.sql — correções de contrato
-- entidade × schema (validação em Postgres real 2026-10-13 via boot com
-- hibernate.ddl-auto=validate):
--   1) loja: entity Loja mapeia flowbox_url/flowbox_api_key/flowbox_web_url
--      (integração Flowbox — R9/ADR-004) mas nenhuma migration criava.
--   2) ordem_servico_pagamento: entity estende EntidadeBase (ativo +
--      @SQLRestriction) mas a V26 não criou a coluna.

ALTER TABLE loja ADD COLUMN IF NOT EXISTS flowbox_url VARCHAR(255);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS flowbox_api_key VARCHAR(255);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS flowbox_web_url VARCHAR(255);

ALTER TABLE ordem_servico_pagamento ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN loja.flowbox_api_key IS 'Credencial Flowbox (R9/ADR-004) — nunca logar em plain';
COMMENT ON COLUMN ordem_servico_pagamento.ativo IS 'Padrão EntidadeBase — soft-delete/@SQLRestriction';
