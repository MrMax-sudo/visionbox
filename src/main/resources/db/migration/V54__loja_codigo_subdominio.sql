-- V54__loja_codigo_subdominio.sql — VisionBox — Identificador curto (LJ-xxx), Subdomínio multi-tenant e status ativo
-- Facilita operação humana, isolamento por subdomínio e ciclo de vida da loja SaaS.

ALTER TABLE loja ADD COLUMN IF NOT EXISTS codigo VARCHAR(20);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS subdominio VARCHAR(60);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Popula lojas conhecidas com identificadores padronizados
UPDATE loja SET codigo = 'LJ-001', subdominio = 'matriz' WHERE id = '00000000-0000-0000-0000-000000000001' AND codigo IS NULL;
UPDATE loja SET codigo = 'LJ-002', subdominio = 'teste' WHERE id = 'f3c30b6a-aaaa-47d0-af04-2295b216faf8' AND codigo IS NULL;
UPDATE loja SET codigo = 'LJ-003', subdominio = 'opticanacional' WHERE id = '6924da89-a9d5-4b82-9402-a94e1846da0d' AND codigo IS NULL;

-- Garante que qualquer outra loja sem código/subdomínio receba valor não nulo
DO $$
DECLARE
    r RECORD;
    i INT := 4;
BEGIN
    FOR r IN SELECT id, nome FROM loja WHERE codigo IS NULL LOOP
        UPDATE loja 
        SET codigo = 'LJ-' || LPAD(i::text, 3, '0'),
            subdominio = COALESCE(subdominio, 'loja-' || SUBSTRING(r.id::text, 1, 8))
        WHERE id = r.id;
        i := i + 1;
    END LOOP;
END $$;

-- Sequence para novos códigos sequenciais de loja
CREATE SEQUENCE IF NOT EXISTS seq_loja_codigo START WITH 10;

-- Índices parciais de unicidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_codigo ON loja (codigo) WHERE codigo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_loja_subdominio ON loja (subdominio) WHERE subdominio IS NOT NULL;

-- Garante que desenvolvedor@techboxbr.com.br tenha o perfil correto de DESENVOLVEDOR
UPDATE usuario SET perfil = 'DESENVOLVEDOR' WHERE email = 'desenvolvedor@techboxbr.com.br' AND perfil != 'DESENVOLVEDOR';
