-- V41__baixa_desconto_juros.sql — Fase 3 Robustez §3.3: baixa de Conta a Receber com desconto/juros.
-- Usa V41 (e não V40) porque V40__pagamento_parcelas.sql já existia no disco (agente paralelo,
-- módulo ordemservico/comissao — coordenado em runtime; sem dependência entre as migrations).
-- Semântica (docs/decisions.md D-021):
--   * valor_desconto — parcela do título quitada SEM dinheiro entrar: soma a valor_pago
--     agregado da conta (fonte da coluna GENERATED valor_aberto). Ex.: saldo 100,
--     valorPago 90 + desconto 10 → valor_pago=100, valor_aberto=0, status PAGO.
--   * valor_juros — receita extra paga pelo cliente (mora/multa): NÃO altera valor_aberto;
--     entra no caixa somada ao valorPago (movimento ENTRADA/RECEBIMENTO_FIADO).
-- Colunas nullable com DEFAULT 0 (linhas V34 pré-existentes passam a reportar 0 —
-- PG 11+ fast default, sem rewrite). CHECK >= 0 como defesa em profundidade (validação
-- de request fica no service → 400 antes de chegar aqui).
-- Multi-tenant: tabela conta_receber_pagamento já tem loja_id NOT NULL + RLS FORCE (V34) — sem DDL de RLS aqui.

ALTER TABLE conta_receber_pagamento
    ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(12,2) DEFAULT 0;
ALTER TABLE conta_receber_pagamento
    ADD COLUMN IF NOT EXISTS valor_juros NUMERIC(12,2) DEFAULT 0;

ALTER TABLE conta_receber_pagamento DROP CONSTRAINT IF EXISTS ck_conta_receber_pagamento_desconto;
ALTER TABLE conta_receber_pagamento
    ADD CONSTRAINT ck_conta_receber_pagamento_desconto CHECK (valor_desconto IS NULL OR valor_desconto >= 0);
ALTER TABLE conta_receber_pagamento DROP CONSTRAINT IF EXISTS ck_conta_receber_pagamento_juros;
ALTER TABLE conta_receber_pagamento
    ADD CONSTRAINT ck_conta_receber_pagamento_juros CHECK (valor_juros IS NULL OR valor_juros >= 0);

COMMENT ON COLUMN conta_receber_pagamento.valor_desconto IS
    'Desconto concedido nesta baixa (§3.3/D-021): abate valor_aberto JUNTO com valor_pago da linha — quita parte do título sem dinheiro entrar. Soma ao valor_pago agregado da conta (fonte do valor_aberto GENERATED).';
COMMENT ON COLUMN conta_receber_pagamento.valor_juros IS
    'Juros/multa recebidos nesta baixa (§3.3/D-021): NÃO altera valor_aberto — receita extra que entra no caixa (movimento valor_pago + valor_juros).';
