CREATE TABLE IF NOT EXISTS usuario_refresh_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES loja(id),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  jti_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_jti_hash varchar(64),
  last_used_at timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  versao bigint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_usuario_refresh_jti_hash ON usuario_refresh_token (jti_hash);
CREATE INDEX IF NOT EXISTS idx_usuario_refresh_usuario ON usuario_refresh_token (loja_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_refresh_active ON usuario_refresh_token (loja_id, usuario_id, expires_at)
  WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_usuario_refresh_token_atualizado ON usuario_refresh_token;
CREATE TRIGGER trg_usuario_refresh_token_atualizado
  BEFORE UPDATE ON usuario_refresh_token
  FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

ALTER TABLE usuario_refresh_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_refresh_token FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loja_isolation ON usuario_refresh_token;
CREATE POLICY loja_isolation ON usuario_refresh_token
  FOR ALL TO PUBLIC
  USING (loja_id = app.current_loja_id())
  WITH CHECK (loja_id = app.current_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON usuario_refresh_token TO app_api, app_pdv;
GRANT SELECT ON usuario_refresh_token TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON usuario_refresh_token TO archival_job;

COMMENT ON TABLE usuario_refresh_token IS 'Refresh JWT jti persistido para rotação e detecção de reuso; valor armazenado só como SHA-256.';
