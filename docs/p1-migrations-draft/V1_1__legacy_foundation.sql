-- =============================================================================
-- DRAFT V1_1__legacy_foundation.sql  (versão Flyway 1.1)
-- =============================================================================
-- DRAFT — validar em Postgres real ANTES de mover para db/migration/.
--
-- POR QUE AQUI: a V2 (posição 2) cria triggers que chamam fn_set_atualizado_em()
-- e faz GRANT/RLS em sequencia_numeracao/perfil/usuario/usuario_loja — nenhum
-- desses objetos existe antes da V2 num banco limpo. Versão "1.1" ordena
-- 1 < 1.1 < 2, resolvendo o requisito SEM alterar a V2 (preserva checksum).
--
-- NÃO contém GRANTs/roles (criados na V2) nem o schema `app` (V11).
--
-- RELAÇÃO COM MIGRATIONS EXISTENTES (verificado 2026-10-13):
--   V2  (pos. 2)  -> usa fn_set_atualizado_em, sequencia_numeracao, fn_next_sequencia,
--                    perfil, usuario, usuario_loja (trigger/RLS/GRANT). Tudo nasce AQUI.
--   V13 (pos. 13) -> CREATE TABLE IF NOT EXISTS usuario = no-op (tabela já existe);
--                    recria trg_usuario_atualizado + RLS/policy/grants (idempotente).
--   V21 (pos. 21) -> usuario_refresh_token.usuario_id REFERENCES usuario(id): ok.
--   V27 (pos. 27) -> DROP CONSTRAINT IF EXISTS usuario_perfil_check + ADD 8 valores.
--                    O CHECK abaixo (sem nome) recebe auto-nome `usuario_perfil_check`
--                    do PG — exatamente o nome que a V27 espera dropar. Sem conflito.
--   V11 (pos. 11) -> usuario/usuario_loja ganham RLS+policy via lista explícita e
--                    varredura dinâmica (ambas têm loja_id). Nada a fazer aqui.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) fn_set_atualizado_em() — trigger BEFORE UPDATE (idempotente)
--    Mesma definição usada em V12/V13/V17/V19 (CREATE OR REPLACE).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2) sequencia_numeracao + fn_next_sequencia(loja_id, tipo, ano)
--    Usado por OS-YYYY-XXXXX / VD-... (hoje o app gera em memória; a função
--    existe para o contrato de V2 e uso futuro em prod).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sequencia_numeracao (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id        uuid         NOT NULL REFERENCES loja(id),
  tipo           varchar(30)  NOT NULL,          -- ex: 'OS', 'VENDA', 'NFCE'
  ano            integer      NOT NULL,
  ultimo_numero  bigint       NOT NULL DEFAULT 0,
  criado_em      timestamptz  NOT NULL DEFAULT now(),
  atualizado_em  timestamptz  NOT NULL DEFAULT now(),
  versao         bigint       NOT NULL DEFAULT 0,
  ativo          boolean      NOT NULL DEFAULT true,
  CONSTRAINT uk_sequencia_loja_tipo_ano UNIQUE (loja_id, tipo, ano)
);
CREATE INDEX IF NOT EXISTS idx_sequencia_loja ON sequencia_numeracao(loja_id);

CREATE OR REPLACE FUNCTION fn_next_sequencia(
    p_loja_id uuid,
    p_tipo    varchar,
    p_ano     integer
) RETURNS bigint AS $$
DECLARE
  v_proximo bigint;
BEGIN
  INSERT INTO sequencia_numeracao (loja_id, tipo, ano, ultimo_numero)
  VALUES (p_loja_id, p_tipo, p_ano, 1)
  ON CONFLICT (loja_id, tipo, ano)
  DO UPDATE SET ultimo_numero = sequencia_numeracao.ultimo_numero + 1,
                atualizado_em = now()
  RETURNING ultimo_numero INTO v_proximo;
  RETURN v_proximo;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3) perfil — tabela de referência GLOBAL (sem loja_id / sem RLS).
--    O app usa o enum Java Perfil; a tabela existe para o GRANT da V2 e
--    consultas de catálogo de perfis. Seed = valores do enum.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfil (
  codigo  varchar(30)  PRIMARY KEY,
  nome    varchar(100) NOT NULL,
  ativo   boolean      NOT NULL DEFAULT true
);

INSERT INTO perfil (codigo, nome) VALUES
  ('ADMIN',        'Administrador'),
  ('GERENTE',      'Gerente'),
  ('VENDEDOR',     'Vendedor'),
  ('OTICO',        'Ótico'),
  ('TECNICO',      'Técnico'),
  ('FINANCEIRO',   'Financeiro'),
  ('LABORATORIO',  'Laboratório'),
  ('DESENVOLVEDOR','Desenvolvedor')
ON CONFLICT (codigo) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4) usuario — mesma forma da V13 (que passa a ser no-op em CREATE TABLE).
--    CHECK com 8 valores = enum Perfil (inclui DESENVOLVEDOR, Fase 3).
--    O PG auto-nomeia o CHECK `usuario_perfil_check` — mesmo nome que a V27
--    dropa/recria (idempotente). Bug latente da V13 (7 valores) e fix:
--    ver CORRECAO_CHECK_USUARIO_PERFIL.md — bancos com V27 aplicada já estão imunes.
--    Trigger trg_usuario_atualizado NÃO nasce aqui de propósito: a V13 o cria
--    (pos. 13); entre 1.1 e 13 nenhuma migration escreve em usuario.
--    DEFAULT 'ADMIN' = paridade com a V13 (a entidade usa builder default VENDEDOR
--    e sempre escreve o valor explicitamente — o default do banco é raramente usado).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     uuid         NOT NULL REFERENCES loja(id),
  nome        varchar(150) NOT NULL,
  email       varchar(255) NOT NULL,
  senha_hash  varchar(255) NOT NULL,
  perfil      varchar(30)  NOT NULL DEFAULT 'ADMIN'
              CHECK (perfil IN ('ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO','DESENVOLVEDOR')),
  ativo       boolean      NOT NULL DEFAULT true,
  criado_em   timestamptz  NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  versao      bigint       NOT NULL DEFAULT 0,
  CONSTRAINT uq_usuario_loja_email UNIQUE (loja_id, email)
);

CREATE INDEX IF NOT EXISTS idx_usuario_loja       ON usuario(loja_id);
CREATE INDEX IF NOT EXISTS idx_usuario_loja_email ON usuario(loja_id, email);
CREATE INDEX IF NOT EXISTS idx_usuario_email      ON usuario(email);

-- -----------------------------------------------------------------------------
-- 5) usuario_loja — vínculo N:N tenant (sem entidade JPA hoje; satisfaz GRANT da V2).
--    Possui loja_id => a RLS dinâmica da V11 cobre automaticamente.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_loja (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     uuid         NOT NULL REFERENCES loja(id),
  usuario_id  uuid         NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  papel       varchar(30),
  ativo       boolean      NOT NULL DEFAULT true,
  criado_em   timestamptz  NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  versao      bigint       NOT NULL DEFAULT 0,
  CONSTRAINT uq_usuario_loja UNIQUE (loja_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_loja_usuario ON usuario_loja(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_loja_loja    ON usuario_loja(loja_id);

-- Nota de manutenção (db-admin): idx_usuario_loja_email duplica a cobertura da
-- UNIQUE uq_usuario_loja_email (mesmas colunas). Mantido por paridade com a V13
-- (que o cria de qualquer forma na posição 13); candidata a DROP INDEX em
-- migration futura de index maintenance.

COMMENT ON TABLE sequencia_numeracao IS 'Sequência por (loja, tipo, ano) — OS-YYYY-XXXXX / VD-YYYY-XXXXX via fn_next_sequencia(); upsert atômico ON CONFLICT (V2 dá RLS/policy, V11 canonicaliza)';
COMMENT ON TABLE perfil IS 'Catálogo GLOBAL de perfis RBAC (sem loja_id/RLS) — autorização do app vem do enum Perfil; tabela satisfaz GRANT da V2 e futura UI de perfis';
COMMENT ON TABLE usuario IS 'Usuário de acesso à loja — nasce aqui (1.1) para o contrato da V2; V13 reafirma forma/RLS; CHECK perfil com 8 valores (V27 normaliza o nome)';
COMMENT ON TABLE usuario_loja IS 'Vínculo N:N usuário×loja (multi-loja futura) — sem entidade JPA hoje; criada para o GRANT da V2; RLS via varredura dinâmica da V11 (tem loja_id)';