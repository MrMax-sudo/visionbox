-- =============================================================================
-- V2__cliente_receita.sql — VisionBox
-- Domínio: Cliente (LGPD: cpf_cipher + cpf_hash) + Receita/Grau + RLS base
-- Depende de V1 (loja, extensões, enums)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Helper para RLS: current_setting app.loja_id
--    Aplicações devem executar: SET LOCAL app.loja_id = '<uuid>'
--    após autenticar JWT (TenantFilter). Se não setado, policy bloqueia tudo.
-- ─────────────────────────────────────────────────────────────────────────────

-- pg_trgm para GIN gin_trgm_ops (busca LIKE '%maria%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Tabela: cliente
--    LGPD: cpf_cipher bytea (AES-GCM app-side: [1B ver][12B nonce][cipher][16B tag])
--          cpf_hash varchar(64) = HMAC-SHA256(pepper, cpf_normalizado) — busca sem decrypt
--    Busca por nome usa GIN pg_trgm; CPF busca por hash exato.
--    Soft-delete via ativo=false (nunca DELETE se há OS com NF <5 anos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cliente (
  id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id               uuid            NOT NULL REFERENCES loja(id),
  nome                  varchar(150)    NOT NULL,
  -- LGPD criptografia
  cpf_cipher            bytea,                      -- null se não informado; criptografado app-side
  cpf_hash              varchar(64),                -- hex sha256 hmac; único por loja quando preenchido
  data_nascimento       date,
  -- Contato (embedded)
  telefone              varchar(20),
  whatsapp              varchar(20),
  email                 varchar(255),
  canal_preferido       varchar(20)     NOT NULL DEFAULT 'WHATSAPP'
                        CHECK (canal_preferido IN ('WHATSAPP','SMS','EMAIL','TELEFONE')),
  score_recompra        integer         CHECK (score_recompra BETWEEN 0 AND 100),
  -- Endereço (embedded — desnormalizado para performance; ViaCEP preenche)
  cep                   varchar(8),     -- somente dígitos
  logradouro            varchar(255),
  numero                varchar(20),
  complemento           varchar(100),
  bairro                varchar(100),
  cidade                varchar(100),
  uf                    char(2)         CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  -- LGPD consentimento recall
  consentimento_recall          boolean         NOT NULL DEFAULT false,
  consentimento_recall_em       timestamptz,
  consentimento_recall_versao   varchar(20),
  consentimento_recall_revogado_em timestamptz,
  -- Convênio padrão (FK opcional — tabela convenio criada em V6; deixar sem FK por enquanto)
  -- convenio_id uuid REFERENCES convenio(id),

  -- Auditoria & tenant
  ativo                 boolean         NOT NULL DEFAULT true,
  criado_em             timestamptz     NOT NULL DEFAULT now(),
  atualizado_em         timestamptz     NOT NULL DEFAULT now(),
  versao                bigint          NOT NULL DEFAULT 0,

  -- CPF hash único por loja (permite CPF duplicado em lojas diferentes, bloqueia na mesma loja)
  CONSTRAINT uq_cliente_loja_cpf_hash UNIQUE (loja_id, cpf_hash)
);

-- Índices essenciais
CREATE INDEX IF NOT EXISTS idx_cliente_loja ON cliente (loja_id);
CREATE INDEX IF NOT EXISTS idx_cliente_loja_nome ON cliente (loja_id, nome);
-- GIN trigram para busca LIKE '%maria%' <500ms em 50k clientes
CREATE INDEX IF NOT EXISTS idx_cliente_nome_trgm ON cliente USING gin (nome gin_trgm_ops);
-- Busca por hash (login/consulta CPF): cobre nome e email para evitar heap fetch
CREATE INDEX IF NOT EXISTS idx_cliente_cpf_hash ON cliente (cpf_hash) WHERE cpf_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_cpf_hash_loja_partial ON cliente (loja_id, cpf_hash) WHERE cpf_hash IS NOT NULL;
-- Filtro por canal preferido para campanhas recall
CREATE INDEX IF NOT EXISTS idx_cliente_canal ON cliente (loja_id, canal_preferido) WHERE ativo = true;
-- Índice parcial para clientes ativos (maioria das queries)
CREATE INDEX IF NOT EXISTS idx_cliente_ativo ON cliente (loja_id) WHERE ativo = true;
-- Índice para score recompra (ordenar)
CREATE INDEX IF NOT EXISTS idx_cliente_score ON cliente (loja_id, score_recompra DESC) WHERE ativo = true;

DROP TRIGGER IF EXISTS trg_cliente_atualizado ON cliente;
CREATE TRIGGER trg_cliente_atualizado
  BEFORE UPDATE ON cliente
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

COMMENT ON TABLE cliente IS 'Cliente da ótica — LGPD: cpf_cipher bytea AES-GCM + cpf_hash HMAC-SHA256; loja_id obrigatório';
COMMENT ON COLUMN cliente.cpf_cipher IS 'AES-GCM app-side: [1B versão][12B nonce][cipher][16B tag]; DEK derivada HKDF(KEK, loja_id); KEK em Vault/KMS';
COMMENT ON COLUMN cliente.cpf_hash IS 'HMAC-SHA256(pepper, cpf_somente_digitos) hex 64 chars — usado para busca exata sem decrypt';
COMMENT ON COLUMN cliente.cep IS 'CEP somente dígitos (8 chars) — ViaCEP no frontend';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Tabela: receita (dado sensível saúde — art.11 LGPD)
--    Graus criptografados app-side (od_cipher/oe_cipher) quando necessário exibir
--    Mantém colunas numéricas para validação e cálculo; em prod cipher prevalece e numérico pode ser null após rotação
--    Alternativa Fase 1: armazenar numérico plain + cipher; Fase 2: apenas cipher (decrypt app-side)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receita (
  id                    uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id               uuid            NOT NULL REFERENCES loja(id),
  cliente_id            uuid            NOT NULL REFERENCES cliente(id) ON DELETE RESTRICT,
  data_emissao          date            NOT NULL,
  data_validade         date            NOT NULL, -- usado para job recall (índice)
  nome_medico           varchar(150),
  crm_medico            varchar(20),
  -- Grau OD (olho direito) — valores numéricos validados; cipher opcional para LGPD
  od_esferico           numeric(5,2)    CHECK (od_esferico BETWEEN -30 AND 30),
  od_cilindrico         numeric(5,2)    CHECK (od_cilindrico BETWEEN -10 AND 0),
  od_eixo               integer         CHECK (od_eixo BETWEEN 0 AND 180),
  od_adicao             numeric(4,2)    CHECK (od_adicao BETWEEN 0 AND 6),
  od_dnp                numeric(4,1),   -- distância naso-pupilar
  od_cipher             bytea,          -- AES-GCM do bloco GrauOlho OD (quando sensível)
  -- Grau OE
  oe_esferico           numeric(5,2)    CHECK (oe_esferico BETWEEN -30 AND 30),
  oe_cilindrico         numeric(5,2)    CHECK (oe_cilindrico BETWEEN -10 AND 0),
  oe_eixo               integer         CHECK (oe_eixo BETWEEN 0 AND 180),
  oe_adicao             numeric(4,2)    CHECK (oe_adicao BETWEEN 0 AND 6),
  oe_dnp                numeric(4,1),
  oe_cipher             bytea,
  -- Comum
  dp                    numeric(4,1),   -- distância pupilar total (legado)
  tipo                  varchar(20)     NOT NULL DEFAULT 'VISAO_SIMPLES'
                        CHECK (tipo IN ('VISAO_SIMPLES','MULTIFOCAL','BIFOCAL','LENTE_CONTATO')),
  observacao            varchar(500),
  observacao_cipher     bytea,          -- observação sensível criptografada
  anexo_s3_key          varchar(500),   -- S3/MinIO key (nunca bytea no PG) — ex: loja-{id}/receitas/{uuid}.jpg
  anexo_s3_bucket       varchar(100),

  ativo                 boolean         NOT NULL DEFAULT true,
  criado_em             timestamptz     NOT NULL DEFAULT now(),
  atualizado_em         timestamptz     NOT NULL DEFAULT now(),
  versao                bigint          NOT NULL DEFAULT 0,

  -- Validação coerência: se cilíndrico != 0 então eixo deve estar preenchido
  CONSTRAINT chk_receita_od_eixo CHECK (
    od_cilindrico IS NULL OR od_cilindrico = 0 OR (od_eixo IS NOT NULL AND od_eixo BETWEEN 0 AND 180)
  ),
  CONSTRAINT chk_receita_oe_eixo CHECK (
    oe_cilindrico IS NULL OR oe_cilindrico = 0 OR (oe_eixo IS NOT NULL AND oe_eixo BETWEEN 0 AND 180)
  ),
  -- Validade não pode ser anterior à emissão
  CONSTRAINT chk_receita_validade CHECK (data_validade >= data_emissao)
);

CREATE INDEX IF NOT EXISTS idx_receita_loja ON receita (loja_id);
CREATE INDEX IF NOT EXISTS idx_receita_cliente ON receita (cliente_id);
CREATE INDEX IF NOT EXISTS idx_receita_loja_cliente ON receita (loja_id, cliente_id);
-- Índices para job recall (receitas vencidas / próximas do vencimento)
CREATE INDEX IF NOT EXISTS idx_receita_validade ON receita (data_validade);
CREATE INDEX IF NOT EXISTS idx_receita_vencida ON receita (loja_id, data_validade)
  WHERE ativo = true;
-- Índice covering para recall: job filtra por data_validade no range (BETWEEN now() -30d AND now()+60d)
-- Não usar CURRENT_DATE no predicate parcial (valor congelaria); deixar sem filtro de data
CREATE INDEX IF NOT EXISTS idx_receita_recall_candidata ON receita (loja_id, data_validade, cliente_id)
  WHERE ativo = true;
-- BRIN para particionamento futuro por data (eficiente para range scan)
-- CREATE INDEX idx_receita_criado_brin ON receita USING brin (criado_em);

DROP TRIGGER IF EXISTS trg_receita_atualizado ON receita;
CREATE TRIGGER trg_receita_atualizado
  BEFORE UPDATE ON receita
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

COMMENT ON TABLE receita IS 'Receita ótica — dado sensível saúde LGPD art.11; grau OD/OE com validação esferico -30..30, cil 0..-10, eixo 0-180; recall por data_validade';
COMMENT ON COLUMN receita.anexo_s3_key IS 'Chave S3/MinIO — nunca bytea no PG; ex: loja-{loja_id}/receitas/{uuid}.jpg com SSE-KMS';
COMMENT ON COLUMN receita.od_cipher IS 'AES-GCM do GrauOlho OD cifrado app-side; descriptografia apenas para perfil OTICO/GERENTE com audit';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RLS — Row Level Security (defesa profunda multi-tenant)
--    Todo acesso deve ter app.loja_id setado; sem isso NENHUMA linha é visível (fail-closed)
--    Roles de app: app_api (DML), app_pdv (DML), app_readonly (SELECT), archival_job (BYPASSRLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilita RLS nas tabelas de tenant
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente FORCE ROW LEVEL SECURITY;
ALTER TABLE receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE receita FORCE ROW LEVEL SECURITY;

-- Também habilita em tabelas V1 que têm loja_id (defesa futura — policies criadas aqui)
ALTER TABLE sequencia_numeracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequencia_numeracao FORCE ROW LEVEL SECURITY;

-- Políticas: isola por loja_id = current_setting('app.loja_id')::uuid
-- Usando COALESCE com exceção controlada para falhar fechado quando não setado
DROP POLICY IF EXISTS loja_isolation_cliente ON cliente;
CREATE POLICY loja_isolation_cliente ON cliente
  USING (loja_id = current_setting('app.loja_id', true)::uuid)
  WITH CHECK (loja_id = current_setting('app.loja_id', true)::uuid);

DROP POLICY IF EXISTS loja_isolation_receita ON receita;
CREATE POLICY loja_isolation_receita ON receita
  USING (loja_id = current_setting('app.loja_id', true)::uuid)
  WITH CHECK (loja_id = current_setting('app.loja_id', true)::uuid);

DROP POLICY IF EXISTS loja_isolation_sequencia ON sequencia_numeracao;
CREATE POLICY loja_isolation_sequencia ON sequencia_numeracao
  USING (loja_id = current_setting('app.loja_id', true)::uuid)
  WITH CHECK (loja_id = current_setting('app.loja_id', true)::uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Roles de aplicação (princípio do menor privilégio)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- app_api: backend Spring Boot (DML completo nas tabelas de negócio)
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
  END IF;
END
$$;

-- Grants — app_api / app_pdv (escrita)
GRANT USAGE ON SCHEMA public TO app_api, app_pdv, app_readonly, archival_job;
GRANT SELECT, INSERT, UPDATE, DELETE ON cliente TO app_api, app_pdv;
GRANT SELECT, INSERT, UPDATE, DELETE ON receita TO app_api, app_pdv;
GRANT SELECT, INSERT, UPDATE, DELETE ON sequencia_numeracao TO app_api, app_pdv;
GRANT EXECUTE ON FUNCTION fn_next_sequencia(uuid, varchar, int) TO app_api, app_pdv;
GRANT EXECUTE ON FUNCTION fn_set_atualizado_em() TO app_api, app_pdv;

-- Grants — readonly (BI / relatórios)
GRANT SELECT ON cliente TO app_readonly;
GRANT SELECT ON receita TO app_readonly;
GRANT SELECT ON sequencia_numeracao TO app_readonly;

-- Grants — loja e tabelas V1 para app_api (necessário para TenantFilter)
GRANT SELECT, INSERT, UPDATE ON loja TO app_api, app_pdv;
GRANT SELECT ON perfil TO app_api, app_pdv, app_readonly;
GRANT SELECT ON usuario TO app_api, app_pdv;
GRANT SELECT ON usuario_loja TO app_api, app_pdv;

-- Revoga escrita em tabelas sensíveis para readonly (defesa)
REVOKE INSERT, UPDATE, DELETE ON cliente FROM app_readonly;
REVOKE INSERT, UPDATE, DELETE ON receita FROM app_readonly;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Auditoria: garante que app_api não pode burlar RLS (FORCE já garante)
--    e que cliente/receita não aceitam loja_id null
-- ─────────────────────────────────────────────────────────────────────────────
-- (constraints NOT NULL já garantem loja_id obrigatório)

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Índices adicionais para LGPD / anonimização
-- ─────────────────────────────────────────────────────────────────────────────
-- Para anonimização após 5 anos (CTN art.174) sem quebrar FK de OS:
-- UPDATE cliente SET nome='ANONIMIZADO '||substr(cpf_hash,1,8), cpf_cipher=null, cpf_hash=null, email=null, telefone=null ...
-- Índice para identificar candidatos a anonimização (criado_em antigo)
CREATE INDEX IF NOT EXISTS idx_cliente_anonimizacao ON cliente (loja_id, criado_em) WHERE ativo = true;

COMMENT ON INDEX idx_cliente_nome_trgm IS 'GIN trigram para busca nome cliente — validar com EXPLAIN ANALYZE antes de adicionar mais índices';
