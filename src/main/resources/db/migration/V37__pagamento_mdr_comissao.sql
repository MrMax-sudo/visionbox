-- V37__pagamento_mdr_comissao.sql — Fase 4 Robustez: MDR no pagamento da venda PDV (§3.5)
-- + gatilho de apuração automática de comissão na finalização da venda (§3.6).
-- Referência canônica: docs/PLANO_ROBUSTEZ_ERP_REFERENCIA_OUTBOX.md §3.5, §3.6
-- + Outbox ERP (VendaPagamento, MaquininhaCartao, ComissaoLancamento).
--
-- Colunas novas em ordem_servico_pagamento (criada em V26). Tri-state documentado:
--   * Não-cartão identificado (DINHEIRO/PIX/CREDIARIO): taxa_valor = 0.00,
--     valor_liquido = valor — isento de MDR, líquido conhecido.
--   * Cartão com maquininha resolvida: taxa_valor/valor_liquido calculados por
--     MdrCalculoService (taxaValor = valor * (pct/100) + fixa; HALF_EVEN 2 casas).
--   * Cartão sem maquininha resolvida (sem maquininha_id no payload do PDV,
--     loja com 0 ou >1 maquininhas ativas, ou falha de cálculo): NULL/NULL —
--     MDR pendente, recalculável na conciliação posterior. Nunca chuta taxa.
--
-- maquininha_id: FK real para maquininha_cartao (V35) — ambas existem quando V37
-- roda (V37 > V35). Mesmo padrão de ordem_servico_pagamento, que usa FK para
-- loja/ordem_servico/forma_pagamento (V26); sem FK fica reservado a entidades
-- afetadas por D-005 (produto/pedido_venda/usuario), o que não é o caso.
--
-- RLS: ordem_servico_pagamento já tem ENABLE/FORCE ROW LEVEL SECURITY + policy
-- loja_isolation (V26) — ALTER TABLE não exige recriar policy; colunas herdam
-- grants da tabela. Comissão não gera DDL novo: a apuração persiste em
-- comissao_lancamento (V35) vinculada por venda_id (UUID solto, D-005).

ALTER TABLE ordem_servico_pagamento
    ADD COLUMN IF NOT EXISTS taxa_valor NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS maquininha_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_osp_maquininha') THEN
        ALTER TABLE ordem_servico_pagamento
            ADD CONSTRAINT fk_osp_maquininha
            FOREIGN KEY (maquininha_id) REFERENCES maquininha_cartao(id);
    END IF;
END$$;

-- Consultas de conciliação por maquininha (partial: pagamentos não-cartão são a maioria).
CREATE INDEX IF NOT EXISTS idx_osp_maquininha
    ON ordem_servico_pagamento(maquininha_id) WHERE maquininha_id IS NOT NULL;

COMMENT ON COLUMN ordem_servico_pagamento.taxa_valor IS 'MDR do pagamento (§3.5): valor * (taxaPercentual/100) + taxaFixa da faixa. NULL = não-cartão não resolvido ou cartão com MDR pendente (sem maquininha resolvida).';
COMMENT ON COLUMN ordem_servico_pagamento.valor_liquido IS 'Valor líquido recebido (§3.5): valor - taxa_valor. Não-cartão isento: valor. Cartão sem maquininha resolvida: NULL (pendente para conciliação).';
COMMENT ON COLUMN ordem_servico_pagamento.maquininha_id IS 'Maquininha cuja taxa foi aplicada (FK maquininha_cartao). Resolução: id explícito do payload PDV, ou única maquininha ativa da loja; senão NULL.';
