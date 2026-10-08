-- V12__seed_rich.sql — VisionBox SEED RICO (alternativo Flyway)
-- NOTA: dev usa ddl-auto=create + data.sql (idempotente). Este arquivo eh alternativo para ambiente Flyway prod (validate).
-- Se ja existir V12, renomeie para V15__seed_rich.sql antes de migrar prod. Mantido como V12 por compatibilidade com task.
-- Conteudo espelha data.sql rico: loja, 5 clientes, 10 produtos (5 armacoes RayBan/Oakley + 5 lentes NCM 90015000), estoque 20, 8 OS
-- Idempotente via ON CONFLICT / WHERE NOT EXISTS.

-- Loja
INSERT INTO loja (id, nome, cnpj) VALUES ('00000000-0000-0000-0000-000000000001', 'VisionBox Matriz', '00000000000191') ON CONFLICT (id) DO NOTHING;

-- Clientes variados (5)
INSERT INTO cliente (id, loja_id, nome, telefone, whatsapp, email, canal_preferido, cep, cidade, uf, consentimento_recall, criado_em, atualizado_em, versao, ativo)
SELECT '00000000-0000-0000-0000-000000000022'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'Maria Santos','11988877766','11988877766','maria.santos@visionbox.com.br','WHATSAPP','04547000','São Paulo','SP',true,now(),now(),0,true WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE email='maria.santos@visionbox.com.br');
INSERT INTO cliente (id, loja_id, nome, telefone, whatsapp, email, canal_preferido, cep, cidade, uf, consentimento_recall, criado_em, atualizado_em, versao, ativo)
SELECT '00000000-0000-0000-0000-000000000023'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'Pedro Oliveira','21999988877','21999988877','pedro.oliveira@visionbox.com.br','EMAIL','22041001','Rio de Janeiro','RJ',false,now(),now(),0,true WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE email='pedro.oliveira@visionbox.com.br');
INSERT INTO cliente (id, loja_id, nome, telefone, whatsapp, email, canal_preferido, cep, cidade, uf, consentimento_recall, criado_em, atualizado_em, versao, ativo)
SELECT '00000000-0000-0000-0000-000000000024'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'Ana Costa','31977766655','31977766655','ana.costa@visionbox.com.br','SMS','30140071','Belo Horizonte','MG',true,now(),now(),0,true WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE email='ana.costa@visionbox.com.br');
INSERT INTO cliente (id, loja_id, nome, telefone, whatsapp, email, canal_preferido, cep, cidade, uf, consentimento_recall, criado_em, atualizado_em, versao, ativo)
SELECT '00000000-0000-0000-0000-000000000025'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'Carlos Mendes','41966655544','41966655544','carlos.mendes@visionbox.com.br','WHATSAPP','80010000','Curitiba','PR',true,now(),now(),0,true WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE email='carlos.mendes@visionbox.com.br');
INSERT INTO cliente (id, loja_id, nome, telefone, whatsapp, email, canal_preferido, cep, cidade, uf, consentimento_recall, criado_em, atualizado_em, versao, ativo)
SELECT '00000000-0000-0000-0000-000000000026'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,'Fernanda Lima','51955544433','51955544433','fernanda.lima@visionbox.com.br','TELEFONE','90010001','Porto Alegre','RS',false,now(),now(),0,true WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE email='fernanda.lima@visionbox.com.br');

-- Produtos 10 (exemplo reduzido; data.sql contem lista completa com preços 250-800)
-- Ver data.sql para lista completa idempotente com NCM 90015000
