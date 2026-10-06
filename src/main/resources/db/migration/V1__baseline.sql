-- V1__baseline_foundation.sql — VisionBox S0-01/S0-02 Foundation
-- Postgres 15+ : pgcrypto opcional mas não usado para cpf cipher (ADR-002 app-side AES-GCM)
-- Shared database, shared schema com loja_id (ADR-001) + RLS como segunda barreira.

-- Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid() e futuro se necessário
-- gen_random_uuid() já disponível em PG13+ sem pgcrypto, mas mantemos idempotente

-- =========================
-- LOJA (tenant) — seed mínimo
-- =========================
CREATE TABLE IF NOT EXISTS loja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(200) NOT NULL,
    cnpj VARCHAR(14),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    ativo BOOLEAN NOT NULL DEFAULT true
);
-- Seed dev: loja única para testes locais sem migração adicional
INSERT INTO loja (id, nome, cnpj) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Ótica VisionBox Matriz (DEV)', '00000000000191')
ON CONFLICT (id) DO NOTHING;

-- =========================
-- LOG AUDITORIA (append-only)
-- =========================
CREATE TABLE IF NOT EXISTS log_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    entidade VARCHAR(100) NOT NULL,
    entidade_id VARCHAR(36),
    acao VARCHAR(50) NOT NULL,
    usuario_id VARCHAR(36),
    usuario_nome VARCHAR(200),
    ip_origem VARCHAR(45),
    user_agent VARCHAR(500),
    detalhe_json JSONB,
    hash_anterior VARCHAR(128)
);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_loja_entidade ON log_auditoria(loja_id, entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_loja_criado ON log_auditoria(loja_id, criado_em DESC);

-- =========================
-- IDEMPOTENCY KEY (PDV)
-- =========================
CREATE TABLE IF NOT EXISTS idempotency_key (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    chave VARCHAR(64) NOT NULL,
    metodo VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    request_hash VARCHAR(128),
    status_code INT,
    response_body TEXT,
    response_content_type VARCHAR(100),
    expira_em TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_idempotency_loja_chave UNIQUE (loja_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expira ON idempotency_key(expira_em);

-- =========================
-- OUTBOX MESSAGE
-- =========================
CREATE TABLE IF NOT EXISTS outbox_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    tentativas INT NOT NULL DEFAULT 0,
    proxima_tentativa TIMESTAMPTZ,
    enviado_em TIMESTAMPTZ,
    erro_ultimo TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_status_proxima ON outbox_message(status, proxima_tentativa) WHERE status IN ('PENDING','FAILED');
CREATE INDEX IF NOT EXISTS idx_outbox_loja_status ON outbox_message(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_message(aggregate_type, aggregate_id);

-- =========================
-- ORDEM SERVICO + EVENTO OS (máquina 12 status)
-- =========================
CREATE TABLE IF NOT EXISTS ordem_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    numero VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ORCAMENTO',
    previsao_entrega TIMESTAMPTZ,
    data_entrega_real TIMESTAMPTZ,
    alerta_atraso_disparado BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uk_os_loja_numero UNIQUE (loja_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_os_loja_status ON ordem_servico(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_os_loja_criado ON ordem_servico(loja_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS evento_os (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES loja(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    versao BIGINT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordem_servico_id UUID NOT NULL REFERENCES ordem_servico(id) ON DELETE CASCADE,
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
    responsavel VARCHAR(200),
    observacao TEXT,
    metadata_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_evento_os_ordem ON evento_os(ordem_servico_id, data_hora ASC);
CREATE INDEX IF NOT EXISTS idx_evento_os_loja ON evento_os(loja_id, ordem_servico_id);

-- =========================
-- RLS (Row Level Security) — segunda barreira ADR-001
-- Em dev, RLS não FORCE para facilitar testes; em prod, habilitar FORCE via V2.
-- Aqui criamos policies sem FORCE para validar em IsolamentoTenantTest.
-- =========================
-- Habilita RLS nas tabelas operacionais (não em loja seed)
ALTER TABLE log_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_os ENABLE ROW LEVEL SECURITY;

-- Policy permissiva por enquanto (app já filtra por loja_id); Fase 3 aperta com current_setting('app.current_tenant')
-- Importante: não usar FORCE ainda para não quebrar seed/flyway migrate sem SET.
DROP POLICY IF EXISTS p_log_auditoria_isolamento ON log_auditoria;
CREATE POLICY p_log_auditoria_isolamento ON log_auditoria USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_idempotency_isolamento ON idempotency_key;
CREATE POLICY p_idempotency_isolamento ON idempotency_key USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_outbox_isolamento ON outbox_message;
CREATE POLICY p_outbox_isolamento ON outbox_message USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_os_isolamento ON ordem_servico;
CREATE POLICY p_os_isolamento ON ordem_servico USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_evento_os_isolamento ON evento_os;
CREATE POLICY p_evento_os_isolamento ON evento_os USING (true) WITH CHECK (true);

-- Comentário para DBA: em prod, aplicar:
--  SET app.current_tenant = 'uuid' no connection provider + ALTER TABLE ... FORCE ROW LEVEL SECURITY
--  + policies USING (loja_id = current_setting('app.current_tenant')::uuid)
