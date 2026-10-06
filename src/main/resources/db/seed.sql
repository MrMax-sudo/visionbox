-- VisionBox bootstrap data for local/dev databases.
-- Do not seed customers, products, OS, stock or finance with fictitious records.

INSERT INTO loja (id, nome, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'VisionBox Matriz', '00000000000191')
ON CONFLICT (id) DO NOTHING;

-- Initial password: admin123
INSERT INTO usuario (id, loja_id, nome, email, senha_hash, perfil, criado_em, atualizado_em, versao, ativo)
SELECT '00000000-0000-0000-0000-000000000002'::uuid,
       '00000000-0000-0000-0000-000000000001'::uuid,
       'Admin VisionBox',
       'admin@visionbox.com.br',
       '$2a$10$z5B7nAMJF3/YsstoCGp8Hupne6UnWl3WmgmCo14itEaRamNT8o7m6',
       'ADMIN',
       now(), now(), 0, true
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario
  WHERE loja_id = '00000000-0000-0000-0000-000000000001'
    AND email = 'admin@visionbox.com.br'
);
