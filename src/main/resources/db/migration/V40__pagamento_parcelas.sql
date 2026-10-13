-- V40__pagamento_parcelas.sql — Persistência de parcelas do pagamento (§3.5, follow-up D-017).
-- O payload do PDV já enviava `pagamentos[].parcelas` (PagamentoRequest, V37) e o cálculo
-- MDR usava o valor efetivo (crédito parcelável = payload; débito/crédito sem
-- `permiteParcelar` = 1), mas o valor NÃO era persistido — a resposta da OS não podia
-- exibir parcelas nem o histórico da venda reconstruir a faixa usada.
--
-- Coluna em ordem_servico_pagamento (criada em V26, MDR em V37):
--   * parcelas INT NOT NULL DEFAULT 1 — 1 = à vista/débito/não-cartão;
--   * backfill: linhas existentes (V26..V37) recebem 1 — sem registro de parcelas no
--     payload antigo, 1 é o default documentado do fluxo (nunca chuta 3 onde não sabe).
--
-- RLS: ordem_servico_pagamento já tem ENABLE/FORCE ROW LEVEL SECURITY + policy
-- loja_isolation (V26) — ALTER TABLE não exige recriar policy; a coluna herda grants
-- da tabela (mesmo padrão de V37).

ALTER TABLE ordem_servico_pagamento
    ADD COLUMN IF NOT EXISTS parcelas INT;

UPDATE ordem_servico_pagamento SET parcelas = 1 WHERE parcelas IS NULL;

ALTER TABLE ordem_servico_pagamento
    ALTER COLUMN parcelas SET DEFAULT 1,
    ALTER COLUMN parcelas SET NOT NULL;

COMMENT ON COLUMN ordem_servico_pagamento.parcelas IS 'Parcelas do pagamento (§3.5): 1 = à vista/débito/não-cartão; crédito parcelável usa o payload do PDV (mesmo valor efetivo do cálculo MDR). DEFAULT 1 desde V40; linhas anteriores ao V40 têm 1 (backfill).';
