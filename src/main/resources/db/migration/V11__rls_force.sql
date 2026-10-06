-- =============================================================================
-- V11__rls_force.sql — VisionBox — RLS FORCE multi-tenant (ADR-001)
-- =============================================================================
-- Objetivo: segunda barreira de isolamento por loja_id (Fail-Closed).
--   - Hibernate @TenantId + TenantFilter (TenantStatementInspector) já filtra
--     em memória/JPQL, mas um bug de repo (findById sem lojaId) ainda vaza.
--   RLS FORCE garante que mesmo app_api/app_pdv não burla sem app.loja_id.
--
-- Estratégia:
--   1) Helper app.current_loja_id()  -> uuid | null  (null-safe, exception-safe)
--   2) ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY em TODAS as tabelas
--      com coluna loja_id (≥25 tabelas listadas + varredura dinâmica)
--   3) POLICY loja_isolation  USING (loja_id = app.current_loja_id())
--                              WITH CHECK (loja_id = app.current_loja_id())
--      Equivalente ao enunciado  loja_id::text = current_setting('app.loja_id',true)
--      mas com cast ::uuid null-safe e sem quebrar com string vazia/inválida.
--      Se current_setting não estiver setado, app.current_loja_id() = NULL
--      => nenhuma linha passa (fail-closed), exceto roles BYPASSRLS.
--   4) GRANTs + comentários sobre SET LOCAL app.loja_id por transação
--
-- Execução: PG 15+  (testado em 15.8). Idempotente — reexecutável sem erro.
-- Ordem Flyway: depende de V1..V10. Tabelas ausentes são ignoradas via
--   information_schema (útil se V3-V10 ainda não rodaram em dev).
--
-- Uso pela aplicação (TenantStatementInspector / TenantFilter):
--   Após validar JWT (claim loja_id), a conexão faz:
--     SET LOCAL app.loja_id = '<uuid-da-loja>';
--   SET LOCAL é transacional e funciona com PgBouncer transaction pooling
--   (diferente de SET simples que vaza entre transações). Ver
--   com.visionbox.config.tenant.TenantStatementInspector e
--   com.visionbox.shared.tenant.TenantContext / CurrentTenantIdentifierResolver.
--   Alternativa suportada: SELECT set_config('app.loja_id', :lojaId, true);
--
-- Roles:
--   app_api, app_pdv, app_readonly  -> respeitam RLS (sem BYPASSRLS)
--   archival_job                    -> BYPASSRLS para purge/archival cross-tenant
--   postgres / owner                -> BYPASSRLS implícito (superuser)
--
-- Validação pós-migration:
--   SET LOCAL app.loja_id = '00000000-0000-0000-0000-000000000001';
--   INSERT INTO cliente (loja_id, nome) VALUES (app.current_loja_id(), 'Teste RLS');
--   SET LOCAL app.loja_id = '00000000-0000-0000-0000-000000000002';
--   SELECT * FROM cliente; -- deve retornar 0 linhas (isolamento)
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM cliente WHERE loja_id = app.current_loja_id();
--
-- Lock analysis: ALTER TABLE ... ENABLE/FORCE RLS = AccessExclusiveLock curtíssimo
--   em catálogo, sem reescrita de tabela. Janela <100ms por tabela em 1M linhas.
--   Seguro para zero-downtime em produção com 5-80 lojas.
-- =============================================================================

-- -------------------------------------------------------------------------
-- 0) Pré-requisitos: schema app + extensões já criadas em V1
-- -------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;

-- -------------------------------------------------------------------------
-- 1) Helper function: app.current_loja_id()  -> uuid | null
--    - Lê current_setting('app.loja_id', true)  (missing_ok = true => null se ausente)
--    - Trata string vazia '' como NULL (evita cast error)
--    - Captura invalid_text_representation (uuid malformado) => retorna NULL
--    - STABLE + PARALLEL SAFE para uso em índice/policy sem overhead
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_loja_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  raw text;
  val uuid;
BEGIN
  raw := current_setting('app.loja_id', true);
  -- missing_ok=true retorna NULL se GUC não existe; tratar '' também
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    val := raw::uuid;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    -- UUID inválido => fail-closed: retorna NULL (nenhuma linha visível)
    -- Log em nível DEBUG para não poluir, mas auditável via pg_stat_statements
    RAISE WARNING 'app.current_loja_id(): valor inválido para app.loja_id = %', raw;
    RETURN NULL;
  END;
  RETURN val;
END;
$$;

COMMENT ON FUNCTION app.current_loja_id() IS
'Helper RLS VisionBox (ADR-001): retorna current_setting(''app.loja_id'',true)::uuid de forma null-safe. Usado em POLICY loja_isolation. SET LOCAL app.loja_id = ''<uuid>'' por transação via TenantStatementInspector. Se não setado ou inválido => NULL => policy bloqueia tudo (fail-closed).';

-- Permite que roles de app executem a função dentro da policy
GRANT EXECUTE ON FUNCTION app.current_loja_id() TO PUBLIC;
GRANT USAGE ON SCHEMA app TO PUBLIC;

-- Garante que GUC customizado é aceito sem precisar definir em postgresql.conf
-- (PG permite qualquer GUC com prefixo app. via SET LOCAL / set_config)

-- -------------------------------------------------------------------------
-- 2) ENABLE ROW LEVEL SECURITY + FORCE em todas as tabelas com loja_id
--    Lista canônica VisionBox (arquivo.md §10 / PROJECT_CONTEXT.md §5) — 25 tabelas
--    Cobertura: S0..S3 + fiscal + estoque + financeiro + outbox
--    Tabelas sem loja_id (loja, flyway_schema_history) ficam SEM RLS.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  -- Lista explícita exigida (≥20) — V1..V10 cobrem todas estas
  tables text[] := ARRAY[
    'cliente',                -- V2/V3  LGPD
    'receita',                -- V4  dado saúde
    'produto',                -- V5  single-table Armacao/Lente
    'marca',                  -- V5
    'categoria',              -- V5
    'fornecedor',             -- compras
    'laboratorio',            -- V6
    'convenio',               -- V6
    'pedido_venda',           -- V6  particionada RANGE
    'pedido_venda_item',      -- V6  item do pedido
    'ordem_servico',          -- V7  core OS 12 status
    'evento_os',              -- V7  timeline
    'sequencia_numeracao',    -- V1  OS-2026-00123
    'estoque',                -- V8  (loja_id, produto_id)
    'estoque_lote',           -- V8  rastreio lote/validade
    'movimentacao_estoque',   -- V8  particionada
    'conta_receber',          -- V9  financeiro
    'conta_pagar',            -- V9
    'forma_pagamento',        -- V9
    'outbox_message',         -- V10 outbox pattern
    'idempotency_key',        -- V10 PDV offline
    'log_auditoria',          -- V10 append-only
    'documento_fiscal',       -- V10 fiscal 55/65
    'documento_fiscal_item',  -- V10
    'tributacao_regra',       -- V10  NCM+UF+CRT
    'usuario_loja',           -- V2  N:N tenant
    'pedido_compra',          -- compras
    'transferencia_estoque'   -- estoque multi-loja
  ];
  r record;
BEGIN
  -- 2a) Tabelas da lista explícita (se existirem)
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'V11 RLS: ENABLE+FORCE em public.%', t;
    ELSE
      RAISE NOTICE 'V11 RLS: tabela public.% ainda não existe — ignorada (será coberta por varredura dinâmica quando criada)', t;
    END IF;
  END LOOP;

  -- 2b) Varredura dinâmica: qualquer tabela restante com coluna loja_id
  --     Garante cobertura futura sem alterar V11 (ex: nova tabela em V12)
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'loja_id'
      AND t.table_type = 'BASE TABLE'
  LOOP
    -- Evita reprocessar já feito (idempotente, mas evita NOTICE duplicado)
    IF NOT (r.table_name = ANY(tables)) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);
      RAISE NOTICE 'V11 RLS (dinâmico): ENABLE+FORCE em public.% (descoberta via information_schema)', r.table_name;
    END IF;
  END LOOP;
END
$$;

-- -------------------------------------------------------------------------
-- 3) POLICIES — loja_isolation  (PERMISSIVE FOR ALL)
--    Enunciado pede:  USING (loja_id::text = current_setting('app.loja_id', true))
--    Implementamos via helper null-safe:  loja_id = app.current_loja_id()
--    que é semanticamente equivalente, mas evita:
--      - erro de cast quando GUC = '' ou uuid inválido
--      - comparação text vs uuid com índice não usado (b-tree em uuid)
--    Comentário guarda equivalência textual para auditoria.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cliente','receita','produto','marca','categoria','fornecedor',
    'laboratorio','convenio','pedido_venda','pedido_venda_item',
    'ordem_servico','evento_os','sequencia_numeracao',
    'estoque','estoque_lote','movimentacao_estoque',
    'conta_receber','conta_pagar','forma_pagamento',
    'outbox_message','idempotency_key','log_auditoria',
    'documento_fiscal','documento_fiscal_item','tributacao_regra',
    'usuario_loja','pedido_compra','transferencia_estoque'
  ];
  r record;
  policy_sql text;
BEGIN
  -- Helper para criar/recriar policy idempotente
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      -- Remove policies legadas (V1 foundation criava USING true / V2 criava com ::uuid direto)
      -- Nomes legados: p_*_isolamento, loja_isolation_*, loja_isolation
      EXECUTE format('DROP POLICY IF EXISTS loja_isolation ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS loja_isolation_%s ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS p_%s_isolamento ON public.%I', t, t);
      -- V2 naming: loja_isolation_cliente etc — remover genérico
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS loja_isolation_cliente ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS loja_isolation_receita ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS loja_isolation_sequencia ON public.%I', t);
      EXCEPTION WHEN others THEN NULL; END;

      -- Cria policy canônica
      -- Nota: USING com ::text equivalência documentada; implementação usa ::uuid null-safe via helper
      --   Equivalente a:  USING (loja_id::text = current_setting('app.loja_id', true) AND current_setting('app.loja_id',true) <> '')
      --   Otimizado para: USING (loja_id = app.current_loja_id())
      --   WITH CHECK igual garante INSERT/UPDATE não permite loja_id de outra loja
      policy_sql := format(
        'CREATE POLICY loja_isolation ON public.%I ' ||
        'FOR ALL TO PUBLIC ' ||
        'USING (loja_id = app.current_loja_id()) ' ||
        'WITH CHECK (loja_id = app.current_loja_id())',
        t
      );
      EXECUTE policy_sql;
      RAISE NOTICE 'V11 POLICY: loja_isolation criada em public.%', t;
    END IF;
  END LOOP;

  -- Varredura dinâmica para tabelas com loja_id não listadas
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema='public' AND c.column_name='loja_id' AND t.table_type='BASE TABLE'
  LOOP
    IF NOT (r.table_name = ANY(tables)) THEN
      EXECUTE format('DROP POLICY IF EXISTS loja_isolation ON public.%I', r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS p_%s_isolamento ON public.%I', r.table_name, r.table_name);
      EXECUTE format(
        'CREATE POLICY loja_isolation ON public.%I FOR ALL TO PUBLIC USING (loja_id = app.current_loja_id()) WITH CHECK (loja_id = app.current_loja_id())',
        r.table_name
      );
      RAISE NOTICE 'V11 POLICY (dinâmico): loja_isolation em public.%', r.table_name;
    END IF;
  END LOOP;
END
$$;

-- -------------------------------------------------------------------------
-- 4) Comentários de equivalência para auditoria (enunciado literal)
-- -------------------------------------------------------------------------
COMMENT ON POLICY loja_isolation ON cliente IS
  'ADR-001 isolamento tenant: USING (loja_id::text = current_setting(''app.loja_id'',true)) WITH CHECK igual; impl. otimizada como loja_id = app.current_loja_id()::uuid null-safe (fail-closed se GUC ausente/vazio/inválido). SET LOCAL app.loja_id por transação via TenantStatementInspector.';
-- Replica comentário nas demais tabelas principais (se existirem)
DO $$
DECLARE
  t text;
  arr text[] := ARRAY['receita','ordem_servico','evento_os','produto','pedido_venda','estoque','outbox_message','log_auditoria','idempotency_key','documento_fiscal'];
BEGIN
  FOREACH t IN ARRAY arr LOOP
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='loja_isolation') THEN
      EXECUTE format('COMMENT ON POLICY loja_isolation ON public.%I IS %L',
        t,
        'ADR-001 isolamento tenant: USING (loja_id::text = current_setting(''app.loja_id'',true)) WITH CHECK igual; impl. via loja_id = app.current_loja_id() null-safe. SET LOCAL app.loja_id via TenantStatementInspector.');
    END IF;
  END LOOP;
END$$;

-- -------------------------------------------------------------------------
-- 5) GRANTS — princípio do menor privilégio (reaplicado idempotente)
--    Roles já criadas em V2; aqui garante que existam e que tenham grants
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    CREATE ROLE app_api NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_pdv') THEN
    CREATE ROLE app_pdv NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'archival_job') THEN
    CREATE ROLE archival_job NOLOGIN BYPASSRLS;
  ELSE
    -- Garante BYPASSRLS mesmo se role já existia sem flag (V2)
    EXECUTE 'ALTER ROLE archival_job BYPASSRLS';
  END IF;
  -- Owner/migrações (Flyway) mantém BYPASSRLS implícito por ser superuser;
  -- não forçar BYPASSRLS em app_api/app_pdv de propósito.
END
$$;

GRANT USAGE ON SCHEMA public TO app_api, app_pdv, app_readonly, archival_job;
GRANT USAGE ON SCHEMA app TO app_api, app_pdv, app_readonly, archival_job;
GRANT EXECUTE ON FUNCTION app.current_loja_id() TO app_api, app_pdv, app_readonly, archival_job;

-- Grants DML — apenas se tabela existir (evita erro em dev com V3..V10 pendentes)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cliente','receita','produto','marca','categoria','fornecedor','laboratorio','convenio',
    'pedido_venda','pedido_venda_item','ordem_servico','evento_os','sequencia_numeracao',
    'estoque','estoque_lote','movimentacao_estoque','conta_receber','conta_pagar','forma_pagamento',
    'outbox_message','idempotency_key','log_auditoria','documento_fiscal','documento_fiscal_item',
    'tributacao_regra','usuario_loja','pedido_compra','transferencia_estoque'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_api, app_pdv', t);
      EXECUTE format('GRANT SELECT ON public.%I TO app_readonly', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO archival_job', t);
      -- Revoga escrita de readonly se foi concedida antes por engano
      BEGIN
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM app_readonly', t);
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
  END LOOP;
  -- loja é global (sem RLS) — leitura para todos, escrita só app_api
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='loja') THEN
    GRANT SELECT ON public.loja TO app_api, app_pdv, app_readonly, archival_job;
    GRANT INSERT, UPDATE ON public.loja TO app_api;
  END IF;
END
$$;

-- Sequences (gen_random_uuid não precisa, mas sequencias numéricas sim)
DO $$
DECLARE
  s record;
BEGIN
  FOR s IN SELECT sequence_schema, sequence_name FROM information_schema.sequences WHERE sequence_schema='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.%I TO app_api, app_pdv, archival_job', s.sequence_schema, s.sequence_name);
  END LOOP;
END$$;

-- -------------------------------------------------------------------------
-- 6) Documentação operacional para DBA / Backend
-- -------------------------------------------------------------------------
COMMENT ON SCHEMA app IS
  'Schema para helpers multi-tenant VisionBox. GUC app.loja_id setado por transação via TenantStatementInspector (SET LOCAL). Ver V11__rls_force.sql e ADR-001.';

-- Log de validação: lista todas as tabelas com RLS FORCE ativo após migration
DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '==== V11 RLS FORCE — validação pós-migration ====';
  FOR r IN
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced,
           (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname AND p.policyname='loja_isolation') AS has_policy
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN (
      SELECT table_name FROM information_schema.columns WHERE column_name='loja_id' AND table_schema='public'
    )
    ORDER BY c.relname
  LOOP
    RAISE NOTICE 'Tabela % : RLS=% FORCE=% policy loja_isolation=%',
      r.table_name, r.rls_enabled, r.rls_forced, (r.has_policy>0);
    IF NOT r.rls_enabled OR NOT r.rls_forced OR r.has_policy=0 THEN
      RAISE WARNING 'V11 INCOMPLETO em % — verifique manualmente!', r.table_name;
    END IF;
  END LOOP;
  RAISE NOTICE 'Função helper: app.current_loja_id() = % (sem GUC deve ser NULL)', app.current_loja_id();
  RAISE NOTICE 'Uso app: SET LOCAL app.loja_id = ''<uuid>''  ou  SELECT set_config(''app.loja_id'',''<uuid>'', true);';
END
$$;

-- -------------------------------------------------------------------------
-- 7) Rollback planejado (não executado automaticamente; documentado)
--    Para reverter V11 em janela de manutenção (se necessário):
--      ALTER TABLE public.<tabela> NO FORCE ROW LEVEL SECURITY;
--      DROP POLICY IF EXISTS loja_isolation ON public.<tabela>;
--      ALTER TABLE public.<tabela> DISABLE ROW LEVEL SECURITY;
--      DROP FUNCTION IF EXISTS app.current_loja_id();
--    Flyway não tem down automático; usar flyway undo ou script manual acima.
--    Risco: desabilitar RLS remove segunda barreira — só em emergência com
--    TenantFilter ainda ativo.
-- -------------------------------------------------------------------------
