-- V21__unicidade_parcial_produto_sku.sql - VisionBox
--
-- Problema (CRUD de produto):
--   produto(loja_id, sku) tinha UNIQUE COMPLETA + soft-delete (@SQLRestriction ativo = true).
--   Apos um DELETE (soft-delete), o existsBySkuAndLojaId nao enxergava a linha inativa e o
--   INSERT do mesmo SKU estourava a unique -> 400 "Registro duplicado". Excluir e recriar
--   era impossivel.
--
-- Solucao: unicidade PARCIAL, apenas entre linhas ATIVAS.
--   - linhas ativas continuam com SKU unico por loja (garantia igual a antes);
--   - linhas inativas nao disputam mais SKU, permitindo recriar;
--   - nenhuma query JPQL enxerga inativas (restriction), logo nunca ha dois resultados
--     ativos para findBySkuAndLojaId.
--
-- Guardado com to_regclass: a tabela produto nasce fora do Flyway no historico do repo
-- (V3-V10 ausentes), entao a migracao tolera ambiente onde ela ainda nao existe.

DO $$
DECLARE
    con record;
    condef text;
BEGIN
    IF to_regclass('produto') IS NULL THEN
        RAISE NOTICE 'V21: tabela produto nao existe - nada a fazer';
        RETURN;
    END IF;

    -- remove qualquer UNIQUE de (loja_id, sku), seja qual for o nome gerado pelo DDL
    FOR con IN
        SELECT c.conname, pg_get_constraintdef(c.oid) AS def
          FROM pg_constraint c
         WHERE c.conrelid = to_regclass('produto')
           AND c.contype = 'u'
    LOOP
        condef := replace(lower(con.def), ' ', '');
        IF condef LIKE '%unique(loja_id,sku)%' OR condef LIKE '%unique(sku,loja_id)%' THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'produto', con.conname);
            RAISE NOTICE 'V21: removida unique % em produto', con.conname;
        END IF;
    END LOOP;

    -- unicidade parcial: so ativos disputam SKU
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_loja_sku_ativo
             ON produto (loja_id, sku) WHERE ativo = true';
END $$;
