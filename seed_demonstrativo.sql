-- ====================================================================
-- VisionBox — Carga de Dados de Demonstração (Seed Realista)
-- Loja Matriz: 00000000-0000-0000-0000-000000000001
-- ====================================================================

-- 1. Garante a Loja
INSERT INTO loja (id, nome, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'VisionBox Matriz Conceito', '00000000000191')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 2. Equipe de Colaboradores da Ótica (senha admin123 para todos)
-- Hash BCrypt para 'admin123': $2a$10$z5B7nAMJF3/YsstoCGp8Hupne6UnWl3WmgmCo14itEaRamNT8o7m6
INSERT INTO usuario (id, loja_id, nome, email, senha_hash, perfil, criado_em, atualizado_em, versao, ativo)
VALUES 
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Admin VisionBox', 'admin@visionbox.com.br', '$2a$10$z5B7nAMJF3/YsstoCGp8Hupne6UnWl3WmgmCo14itEaRamNT8o7m6', 'ADMIN', now(), now(), 0, true),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Carlos Eduardo Mendes', 'carlos.gerente@visionbox.com.br', '$2a$10$z5B7nAMJF3/YsstoCGp8Hupne6UnWl3WmgmCo14itEaRamNT8o7m6', 'GERENTE', now(), now(), 0, true),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Mariana Silva Costa', 'mariana.vendas@visionbox.com.br', '$2a$10$z5B7nAMJF3/YsstoCGp8Hupne6UnWl3WmgmCo14itEaRamNT8o7m6', 'VENDEDOR', now(), now(), 0, true),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Roberto Rocha Lima', 'roberto.lab@visionbox.com.br', '$2a$10$z5B7nAMJF3/YsstoCGp8Hupne6UnWl3WmgmCo14itEaRamNT8o7m6', 'LABORATORIO', now(), now(), 0, true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil, ativo = true;

-- 3. Catálogo de Produtos com SKUs correspondentes às fotos reais
INSERT INTO produto (id, loja_id, sku, codigo_barras, nome, descricao, tipo_produto, marca, categoria, ncm, cest, cfop, custo, preco_venda, estoque_quantidade, estoque_reservado, ativo_venda, versao, criado_em, atualizado_em, ativo)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'ARM-RAY-001', '7891000100011', 'Ray-Ban Aviador Dourado Clássico', 'Armação metálica dourada com ponteira em acetato tartaruga, design atemporal.', 'ARMACAO', 'Ray-Ban', 'Armação', '90031100', '2805900', '5102', 420.00, 890.00, 15, 2, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ARM-OAK-002', '7891000100028', 'Oakley Holbrook Preto Fosco', 'Armação em O-Matter leve e resistente, estilo retangular moderno e esportivo.', 'ARMACAO', 'Oakley', 'Armação', '90031100', '2805900', '5102', 380.00, 780.00, 12, 1, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ARM-VOG-003', '7891000100035', 'Vogue Eyewear Tartaruga Feminino', 'Armação em acetato premium formato borboleta suave, elegante e confortável.', 'ARMACAO', 'Vogue', 'Armação', '90031100', '2805900', '5102', 290.00, 650.00, 8, 1, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'ARM-PRA-004', '7891000100042', 'Prada Linea Rossa Sport Black', 'Design vanguardista com haste esportiva emborrachada e faixa vermelha Prada.', 'ARMACAO', 'Prada', 'Armação', '90031100', '2805900', '5102', 690.00, 1450.00, 6, 0, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'ARM-CHL-005', '7891000100059', 'Chilli Beans Clubmaster Retrô', 'Armação mista metal e acetato preto, estilo browline vintage.', 'ARMACAO', 'Chilli Beans', 'Armação', '90031100', '2805900', '5102', 180.00, 420.00, 20, 3, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'ARM-ARM-006', '7891000100066', 'Armani Exchange Metal Gunmetal', 'Armação discreta e resistente em titânio grafite fosco.', 'ARMACAO', 'Armani Exchange', 'Armação', '90031100', '2805900', '5102', 340.00, 720.00, 10, 0, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'LEN-ZEI-101', '7891000200018', 'Lente Zeiss Single Vision Individual', 'Lentes monofocais personalizadas com antirreflexo DuraVision Platinum.', 'LENTE', 'Zeiss', 'Lente', '90015000', '2805900', '5102', 520.00, 1100.00, 25, 4, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'LEN-ESS-102', '7891000200025', 'Lente Essilor Varilux Comfort Max', 'Lente multifocal progressiva de alta adaptação e visão ampla para perto e longe.', 'LENTE', 'Essilor', 'Lente', '90015000', '2805900', '5102', 780.00, 1650.00, 18, 3, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'LEN-HOY-103', '7891000200032', 'Lente Hoya BlueControl Filtro Azul', 'Proteção avançada contra luz azul nociva de telas digitais e proteção UV total.', 'LENTE', 'Hoya', 'Lente', '90015000', '2805900', '5102', 310.00, 680.00, 30, 2, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'ACE-EST-201', '7891000300015', 'Estojo Rígido em Couro VisionBox', 'Estojo protetor premium forrado em veludo para conservação de óculos.', 'ACESSORIO', 'VisionBox', 'Acessório', '42023200', '2805900', '5102', 25.00, 85.00, 50, 0, true, 0, now(), now(), true),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'ACE-KIT-202', '7891000300022', 'Kit Limpeza Anti-Embaçante + Flanela', 'Spray higienizador específico para lentes ópticas com microfibra de alta densidade.', 'ACESSORIO', 'VisionBox', 'Acessório', '34029090', '2805900', '5102', 12.00, 45.00, 80, 0, true, 0, now(), now(), true)
ON CONFLICT (id) DO UPDATE SET 
  nome = EXCLUDED.nome, preco_venda = EXCLUDED.preco_venda, custo = EXCLUDED.custo, estoque_quantidade = EXCLUDED.estoque_quantidade;

-- 4. Clientes Reais da Ótica
INSERT INTO cliente (id, loja_id, nome, email, telefone, whatsapp, cep, logradouro, numero, bairro, cidade, uf, canal_preferido, score_recompra, consentimento_recall, versao, criado_em, atualizado_em, ativo)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Ana Paula Souza', 'ana.souza@gmail.com', '11987654321', '11987654321', '01310100', 'Avenida Paulista', '1578', 'Bela Vista', 'São Paulo', 'SP', 'WHATSAPP', 92, true, 0, now() - interval '90 days', now(), true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Marcos Vinicius Ribeiro', 'marcos.ribeiro@outlook.com', '11976543210', '11976543210', '04538133', 'Rua Joaquim Floriano', '720', 'Itaim Bibi', 'São Paulo', 'SP', 'WHATSAPP', 85, true, 0, now() - interval '60 days', now(), true),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Juliana Mendes Ferreira', 'juliana.ferreira@uol.com.br', '11965432109', '11965432109', '05407002', 'Rua dos Pinheiros', '450', 'Pinheiros', 'São Paulo', 'SP', 'WHATSAPP', 78, true, 0, now() - interval '45 days', now(), true),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Fernando Henrique Costa', 'fernando.costa@terra.com.br', '11954321098', '11954321098', '01414001', 'Rua Haddock Lobo', '1307', 'Cerqueira César', 'São Paulo', 'SP', 'WHATSAPP', 65, true, 0, now() - interval '30 days', now(), true),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Beatriz Albuquerque Lima', 'beatriz.lima@yahoo.com.br', '11943210987', '11943210987', '04001001', 'Rua Vergueiro', '2010', 'Vila Mariana', 'São Paulo', 'SP', 'WHATSAPP', 95, true, 0, now() - interval '15 days', now(), true),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Lucas Silveira Santos', 'lucas.silveira@gmail.com', '11932109876', '11932109876', '01228000', 'Rua Higienópolis', '320', 'Higienópolis', 'São Paulo', 'SP', 'WHATSAPP', 70, true, 0, now() - interval '10 days', now(), true),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Camila Rodrigues Prado', 'camila.prado@hotmail.com', '11921098765', '11921098765', '04543000', 'Avenida Brigadeiro Faria Lima', '2232', 'Jardim Paulistano', 'São Paulo', 'SP', 'WHATSAPP', 88, true, 0, now() - interval '5 days', now(), true),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Rodrigo Alves Nogueira', 'rodrigo.nogueira@gmail.com', '11910987654', '11910987654', '01305000', 'Rua Augusta', '1250', 'Consolação', 'São Paulo', 'SP', 'WHATSAPP', 60, true, 0, now() - interval '2 days', now(), true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, whatsapp = EXCLUDED.whatsapp;

-- 5. Prescrições / Receitas Oftalmológicas
INSERT INTO receita (id, loja_id, cliente_id, tipo, data_emissao, data_validade, nome_medico, crm_medico, od_esferico, od_cilindrico, od_eixo, od_adicao, od_dnp, oe_esferico, oe_cilindrico, oe_eixo, oe_adicao, oe_dnp, dp, observacao, versao, criado_em, atualizado_em, ativo)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'LONGE', now() - interval '60 days', now() + interval '305 days', 'Dr. Marcelo Albuquerque', 'CRM-SP 145890', -2.25, -0.75, 180, null, 31.5, -2.00, -0.50, 175, null, 31.0, 62.5, 'Uso contínuo para computador e direção.', 0, now(), now(), true),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'MULTIFOCAL', now() - interval '30 days', now() + interval '335 days', 'Dra. Patrícia Helena Rocha', 'CRM-SP 189201', +1.50, -1.00, 90, 2.25, 32.0, +1.75, -0.75, 85, 2.25, 32.0, 64.0, 'Adaptação a lente multifocal progressiva de campo amplo.', 0, now(), now(), true),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'LONGE', now() - interval '15 days', now() + interval '350 days', 'Dr. Eduardo Vasconcelos', 'CRM-SP 112450', -3.50, -1.25, 15, null, 30.0, -3.75, -1.00, 165, null, 30.5, 60.5, 'Indicação de lente com alto índice de refração (1.67) e antirreflexo.', 0, now(), now(), true),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'PERTO', now() - interval '350 days', now() + interval '15 days', 'Dra. Camila Toledo Prado', 'CRM-SP 167332', +2.00, -0.25, 180, null, 31.0, +2.25, -0.25, 180, null, 31.0, 62.0, 'Receita próxima ao vencimento (alerta recall anual ativado).', 0, now(), now(), true)
ON CONFLICT (id) DO UPDATE SET nome_medico = EXCLUDED.nome_medico;

-- 6. Ordens de Serviço (Kanban Completo de 12 Status)
-- Deleta registros antigos de OS e eventos para garantir coerência no teste
DELETE FROM evento_os WHERE loja_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM conta_receber WHERE loja_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM conta_pagar WHERE loja_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM ordem_servico WHERE loja_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO ordem_servico (id, loja_id, numero, cliente_id, receita_id, armacao_id, lente_id, status, previsao_entrega, criado_em, atualizado_em, versao, ativo)
VALUES
  -- 1 & 2: Orçamento
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'OS-2026-0001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'ORCAMENTO', now() + interval '7 days', now() - interval '2 hours', now(), 0, true),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'OS-2026-0002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000008', 'ORCAMENTO', now() + interval '6 days', now() - interval '4 hours', now(), 0, true),

  -- 3 & 4: Pedido Confirmado
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'OS-2026-0003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000009', 'PEDIDO_CONFIRMADO', now() + interval '5 days', now() - interval '1 day', now(), 0, true),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'OS-2026-0004', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000007', 'PEDIDO_CONFIRMADO', now() + interval '5 days', now() - interval '1 day', now(), 0, true),

  -- 5 & 6: Enviado Laboratório
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'OS-2026-0005', '20000000-0000-0000-0000-000000000005', null, '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000009', 'ENVIADO_LABORATORIO', now() + interval '4 days', now() - interval '2 days', now(), 0, true),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'OS-2026-0006', '20000000-0000-0000-0000-000000000006', null, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'ENVIADO_LABORATORIO', now() + interval '4 days', now() - interval '2 days', now(), 0, true),

  -- 7, 8 & 9: Em Produção
  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'OS-2026-0007', '20000000-0000-0000-0000-000000000007', null, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'EM_PRODUCAO', now() + interval '3 days', now() - interval '3 days', now(), 0, true),
  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'OS-2026-0008', '20000000-0000-0000-0000-000000000008', null, '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000008', 'EM_PRODUCAO', now() + interval '3 days', now() - interval '3 days', now(), 0, true),
  ('40000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'OS-2026-0009', '20000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000009', 'EM_PRODUCAO', now() + interval '2 days', now() - interval '3 days', now(), 0, true),

  -- 10 & 11: Lente Pronta
  ('40000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'OS-2026-0010', '20000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'LENTE_PRONTA', now() + interval '2 days', now() - interval '4 days', now(), 0, true),
  ('40000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'OS-2026-0011', '20000000-0000-0000-0000-000000000003', null, '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000008', 'LENTE_PRONTA', now() + interval '2 days', now() - interval '4 days', now(), 0, true),

  -- 12: Montagem
  ('40000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'OS-2026-0012', '20000000-0000-0000-0000-000000000004', null, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000009', 'MONTAGEM', now() + interval '1 day', now() - interval '5 days', now(), 0, true),

  -- 13 & 14: Controle de Qualidade
  ('40000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'OS-2026-0013', '20000000-0000-0000-0000-000000000005', null, '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', 'CONTROLE_QUALIDADE', now() + interval '1 day', now() - interval '6 days', now(), 0, true),
  ('40000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'OS-2026-0014', '20000000-0000-0000-0000-000000000006', null, '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000008', 'CONTROLE_QUALIDADE', now() + interval '1 day', now() - interval '6 days', now(), 0, true),

  -- 15 & 16: Pronto para Retirada (Notificação WhatsApp enviada)
  ('40000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'OS-2026-0015', '20000000-0000-0000-0000-000000000007', null, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'PRONTO_PARA_RETIRADA', now(), now() - interval '7 days', now(), 0, true),
  ('40000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'OS-2026-0016', '20000000-0000-0000-0000-000000000008', null, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008', 'PRONTO_PARA_RETIRADA', now(), now() - interval '7 days', now(), 0, true),

  -- 17: Retrabalho (Demonstração de contingência e rastreabilidade)
  ('40000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'OS-2026-0017', '20000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000009', 'RETRABALHO', now() + interval '2 days', now() - interval '8 days', now(), 0, true),

  -- 18: Entregue
  ('40000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'OS-2026-0018', '20000000-0000-0000-0000-000000000002', null, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'ENTREGUE', now() - interval '1 day', now() - interval '10 days', now(), 0, true);

-- 7. Eventos da Timeline da OS (Rastreabilidade Real)
INSERT INTO evento_os (id, loja_id, ordem_servico_id, status_anterior, status_novo, responsavel, observacao, data_hora, criado_em, atualizado_em, versao, ativo)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000015', 'CONTROLE_QUALIDADE', 'PRONTO_PARA_RETIRADA', 'Mariana Silva Costa', 'Inspeção CQ aprovada 100%. Mensagem automática de aviso enviada via WhatsApp ao cliente.', now() - interval '2 hours', now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000016', 'CONTROLE_QUALIDADE', 'PRONTO_PARA_RETIRADA', 'Carlos Eduardo Mendes', 'Montagem finalizada e testada no lensômetro digital. Aguardando retirada na loja.', now() - interval '4 hours', now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000017', 'CONTROLE_QUALIDADE', 'RETRABALHO', 'Roberto Rocha Lima', 'Eixo da lente esquerda apresentou desvio de 4 graus. Bloco reenviado para ressurfaçagem prioritária.', now() - interval '1 day', now(), now(), 0, true);

-- 8. Financeiro — Contas a Receber (Demonstrativo Comercial)
INSERT INTO conta_receber (id, loja_id, cliente_id, ordem_servico_id, numero_documento, descricao, valor, valor_pago, vencimento, data_pagamento, status, parcela, total_parcelas, criado_em, atualizado_em, versao, ativo)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000015', 'REC-2026-0015-1', 'Venda Óculos Ray-Ban + Zeiss - Parcela 1/3 (Cartão Crédito)', 663.33, 663.33, current_date - 5, now() - interval '5 days', 'PAGO', 1, 3, now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000015', 'REC-2026-0015-2', 'Venda Óculos Ray-Ban + Zeiss - Parcela 2/3 (Cartão Crédito)', 663.33, null, current_date + 25, null, 'PENDENTE', 2, 3, now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000015', 'REC-2026-0015-3', 'Venda Óculos Ray-Ban + Zeiss - Parcela 3/3 (Cartão Crédito)', 663.34, null, current_date + 55, null, 'PENDENTE', 3, 3, now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000016', 'REC-2026-0016-PIX', 'Venda Óculos Oakley + Varilux Comfort (PIX à vista)', 2430.00, 2430.00, current_date - 2, now() - interval '2 days', 'PAGO', 1, 1, now(), now(), 0, true);

-- 9. Financeiro — Contas a Pagar (Fornecedores de Lentes e Armações)
INSERT INTO conta_pagar (id, loja_id, fornecedor, numero_documento, descricao, valor, valor_pago, vencimento, data_pagamento, status, parcela, total_parcelas, criado_em, atualizado_em, versao, ativo)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Luxottica Brasil Comércio de Ótica', 'NF-98214', 'Fatura mensal reposição Ray-Ban e Oakley', 3850.00, 3850.00, current_date - 3, now() - interval '3 days', 'PAGO', 1, 1, now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Carl Zeiss Vision Brasil', 'FAT-ZEISS-2026', 'Fornecimento de blocos oftálmicos DuraVision Platinum', 2140.00, null, current_date + 10, null, 'PENDENTE', 1, 1, now(), now(), 0, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Essilor International Lab', 'DUP-ESS-0412', 'Lentes multifocais Varilux Comfort Max', 1560.00, null, current_date + 18, null, 'PENDENTE', 1, 1, now(), now(), 0, true);
