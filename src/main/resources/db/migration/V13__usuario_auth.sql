-- V12__usuario_auth.sql — VisionBox — tabela usuario + auth RBAC
-- Stack: Spring Security JWT 15m/7d httpOnly, BCrypt senha_hash, multi-tenant loja_id (ADR-001)

-- Helper function fn_set_atualizado_em (idempotente) — usado por V2 triggers mas pode não existir se V2 não rodou completo
CREATE OR REPLACE FUNCTION fn_set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES loja(id),
  nome varchar(150) NOT NULL,
  email varchar(255) NOT NULL,
  senha_hash varchar(255) NOT NULL,
  perfil varchar(30) NOT NULL DEFAULT 'ADMIN' CHECK (perfil IN ('ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  versao bigint NOT NULL DEFAULT 0,
  CONSTRAINT uq_usuario_loja_email UNIQUE (loja_id, email)
);

CREATE INDEX IF NOT EXISTS idx_usuario_loja ON usuario(loja_id);
CREATE INDEX IF NOT EXISTS idx_usuario_loja_email ON usuario(loja_id, email);
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);

DROP TRIGGER IF EXISTS trg_usuario_atualizado ON usuario;
CREATE TRIGGER trg_usuario_atualizado
  BEFORE UPDATE ON usuario
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- RLS — segunda barreira (fail-closed via app.current_loja_id())
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_isolation ON usuario;
DROP POLICY IF EXISTS loja_isolation_usuario ON usuario;
DROP POLICY IF EXISTS p_usuario_isolamento ON usuario;
CREATE POLICY loja_isolation ON usuario
  FOR ALL TO PUBLIC
  USING (loja_id = app.current_loja_id())
  WITH CHECK (loja_id = app.current_loja_id());

-- Grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_api') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON usuario TO app_api, app_pdv';
    EXECUTE 'GRANT SELECT ON usuario TO app_readonly';
    BEGIN EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON usuario FROM app_readonly'; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END$$;

COMMENT ON TABLE usuario IS 'Usuário VisionBox — multi-tenant por loja_id, senha BCrypt, perfil RBAC';
COMMENT ON COLUMN usuario.senha_hash IS 'BCrypt 10 rounds — nunca plain; validado via PasswordEncoder.matches';
