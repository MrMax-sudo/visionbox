-- Remove known demo seed data from existing environments.
-- Soft-delete only fixed records previously inserted by data.sql/V12__seed_rich.

DO $$
DECLARE
  demo_loja uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  demo_clientes uuid[] := ARRAY[
    '00000000-0000-0000-0000-000000000021'::uuid,
    '00000000-0000-0000-0000-000000000022'::uuid,
    '00000000-0000-0000-0000-000000000023'::uuid,
    '00000000-0000-0000-0000-000000000024'::uuid,
    '00000000-0000-0000-0000-000000000025'::uuid,
    '00000000-0000-0000-0000-000000000026'::uuid
  ];
  demo_produtos uuid[] := ARRAY[
    '00000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000012'::uuid,
    '00000000-0000-0000-0000-000000000013'::uuid,
    '00000000-0000-0000-0000-000000000014'::uuid,
    '00000000-0000-0000-0000-000000000015'::uuid,
    '00000000-0000-0000-0000-000000000016'::uuid,
    '00000000-0000-0000-0000-000000000017'::uuid,
    '00000000-0000-0000-0000-000000000018'::uuid,
    '00000000-0000-0000-0000-000000000019'::uuid,
    '00000000-0000-0000-0000-000000000020'::uuid,
    '00000000-0000-0000-0000-000000000030'::uuid
  ];
  demo_os uuid[] := ARRAY[
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000104'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid,
    '00000000-0000-0000-0000-000000000106'::uuid,
    '00000000-0000-0000-0000-000000000107'::uuid,
    '00000000-0000-0000-0000-000000000108'::uuid
  ];
BEGIN
  IF to_regclass('public.conta_receber') IS NOT NULL THEN
    UPDATE conta_receber
       SET ativo = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND (
         ordem_servico_id = ANY(demo_os)
         OR cliente_id = ANY(demo_clientes)
         OR numero_documento LIKE 'OS-2026-0000%'
         OR descricao LIKE 'OS OS-2026-0000%'
       );
  END IF;

  IF to_regclass('public.evento_os') IS NOT NULL THEN
    UPDATE evento_os
       SET ativo = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND ordem_servico_id = ANY(demo_os);
  END IF;

  IF to_regclass('public.ordem_servico') IS NOT NULL THEN
    UPDATE ordem_servico
       SET ativo = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND (
         id = ANY(demo_os)
         OR numero IN (
           'OS-2026-00001', 'OS-2026-00002', 'OS-2026-00003', 'OS-2026-00004',
           'OS-2026-00005', 'OS-2026-00006', 'OS-2026-00007', 'OS-2026-00008'
         )
       );
  END IF;

  IF to_regclass('public.estoque') IS NOT NULL THEN
    UPDATE estoque
       SET ativo = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND produto_id = ANY(demo_produtos);
  END IF;

  IF to_regclass('public.produto') IS NOT NULL THEN
    UPDATE produto
       SET ativo = false,
           ativo_venda = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND (
         id = ANY(demo_produtos)
         OR sku IN (
           'ARM-RAY001', 'ARM-RAY002', 'ARM-OAK001', 'ARM-RAY003', 'ARM-OAK002',
           'LENTE-PROG01', 'LENTE-PROG02', 'LENTE-PROG03', 'LENTE-PROG04',
           'LENTE-PROG05', 'LCONT-ACUV01'
         )
       );
  END IF;

  IF to_regclass('public.cliente') IS NOT NULL THEN
    UPDATE cliente
       SET ativo = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND (
         id = ANY(demo_clientes)
         OR email IN (
           'joao.demo@visionbox.com.br',
           'maria.santos@visionbox.com.br',
           'pedro.oliveira@visionbox.com.br',
           'ana.costa@visionbox.com.br',
           'carlos.mendes@visionbox.com.br',
           'fernanda.lima@visionbox.com.br'
         )
       );
  END IF;

  IF to_regclass('public.conta_pagar') IS NOT NULL THEN
    UPDATE conta_pagar
       SET ativo = false
     WHERE loja_id = demo_loja
       AND ativo = true
       AND (
         fornecedor ILIKE '%demo%'
         OR fornecedor ILIKE '%visionbox%'
         OR numero_documento LIKE 'DEMO-%'
       );
  END IF;
END $$;
