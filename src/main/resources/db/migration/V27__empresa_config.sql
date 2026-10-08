-- V27__empresa_config.sql — VisionBox — Config Empresa + perfil DESENVOLVEDOR
-- Extende a tabela loja (tenant raiz, SEM loja_id / SEM RLS) com dados de empresa/config
-- usados por Configurações, wa.me dinâmico (suporte) e Painel Desenvolvedor.
-- Permite DESENVOLVEDOR no CHECK de usuario.perfil (RBAC — ADR-003).

ALTER TABLE loja
    ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email_contato VARCHAR(200),
    ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
    ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
    ADD COLUMN IF NOT EXISTS complemento VARCHAR(120),
    ADD COLUMN IF NOT EXISTS bairro VARCHAR(120),
    ADD COLUMN IF NOT EXISTS cidade VARCHAR(120),
    ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
    ADD COLUMN IF NOT EXISTS cep VARCHAR(8),
    ADD COLUMN IF NOT EXISTS site VARCHAR(255),
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- RBAC Fase 3: permite perfil DESENVOLVEDOR (Painel Dev / diagnóstico)
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_perfil_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_perfil_check
    CHECK (perfil IN ('ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO','DESENVOLVEDOR'));

-- loja é global (sem RLS — V11 V_83) — grants já cobertos: SELECT para todos, UPDATE só app_api.
COMMENT ON TABLE loja IS 'Loja (tenant raiz) — inclui dados de config da empresa (V27): telefone/whatsapp/endereço/logo/site';