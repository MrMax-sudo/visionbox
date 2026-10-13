-- V33__caixa_extrato_fechamento.sql — Fase 2 do Plano de Robustez: Gestão de Caixa & Turnos
--
-- Sem tabelas novas: caixa_sessao / caixa_movimento já existem (V23) com loja_id NOT NULL,
-- timestamptz, numeric(12,2) e RLS (ENABLE + FORCE + policy loja_isolation).
-- Aqui: colunas de fechamento cego, garantia de motivo em sangria/suprimento e
-- índices para extrato paginado, histórico por operador/data e apuração por modalidade.

-- 1) Fechamento cego: persiste o valor apurado pelo sistema no instante do fechamento
--    (valorFechamentoSistema = saldo_inicial + entradas - saidas, padrão Outbox ERP Caixa.java).
ALTER TABLE caixa_sessao ADD COLUMN IF NOT EXISTS valor_fechamento_sistema NUMERIC(12, 2);
COMMENT ON COLUMN caixa_sessao.valor_fechamento_sistema IS
  'Conferência cega: valor apurado pelo sistema (saldo_esperado) congelado no fechamento do turno';

-- 2) Sangria e Suprimento exigem motivo. NOT VALID: valida novas linhas/updates sem
--    quebrar migration com dados legados que possuem motivo nulo.
ALTER TABLE caixa_movimento DROP CONSTRAINT IF EXISTS ck_caixa_movimento_motivo_obrigatorio;
ALTER TABLE caixa_movimento ADD CONSTRAINT ck_caixa_movimento_motivo_obrigatorio
    CHECK (tipo NOT IN ('SANGRIA', 'SUPRIMENTO') OR (motivo IS NOT NULL AND length(trim(motivo)) > 0))
    NOT VALID;

-- 3) Extrato do turno paginado por cronologia + histórico de turnos por operador e data
CREATE INDEX IF NOT EXISTS idx_caixa_movimento_sessao_criado
    ON caixa_movimento(sessao_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_caixa_sessao_loja_operador_aberto
    ON caixa_sessao(loja_id, usuario_id, aberto_em DESC);

-- 4) Apuração por modalidade no fechamento (resumo sobre pagamentos da OS por janela do turno)
CREATE INDEX IF NOT EXISTS idx_osp_loja_criado
    ON ordem_servico_pagamento(loja_id, criado_em);
