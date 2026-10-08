# ADR-006 — Relatórios BI (US16): fontes de dados, vendedor e curva ABC

> Status: **Aceito** (2026-10-08) · Decisores: backend-engineer (US16) · Domínio: `com.visionbox.modules.relatorios`

## Contexto

US16 pede 3 endpoints de BI: giro de produtos (quantidade vendida), margem por vendedor/OS e
curva ABC por faturamento. Fontes possíveis de venda no VisionBox:

1. `pedido_venda`/`item_pedido` (PDV genérico, SKU + quantidade + subtotal) — porém as
   migrations V3–V10 estão em reconstrução pelo db-admin (P1) e a DDL real dessas tabelas está
   ausente do repo; o contrato `item_pedido` vs `pedido_venda_item` é ambíguo.
2. `ordem_servico` (armação + lente, `armacao_id`/`lente_id`) + `produto` (`custo`, `preco_venda`)
   + `conta_receber` (`ordem_servico_id`, `valor`) + `evento_os` (`responsavel`) — schema 100%
   visível em V1/V2/V15/V26 e é o documento canônico de venda da ótica.

## Decisões

### D1 — OS + Produto como fonte de giro e ABC (não `pedido_venda`/`item_pedido`)
- Giro e ABC usam `ordem_servico` (1 armação + 1 lente por OS) agregado sobre `produto`.
- Exclui OS `CANCELADO` e `DEVOLVIDO_GARANTIA` (não são venda). Inclui `ENTREGUE`, `CRIADO`
  confirmado etc.
- **Motivo:** confiabilidade (schema garantido), período por `criado_em`, e evita depender de
  DDL ausente. Quando P1 (db-admin) reconstruir V3–V10 e o PDV gravar `item_pedido`, o giro
  pode ser ampliado com UNION dos itens sem quebrar o contrato do endpoint.

### D2 — "Vendedor" da margem = primeiro responsável humano da OS
- Não existe coluna `vendedor_id` em OS/pedido venda. A margem é por **OS** e agrupada pelo
  responsável do **primeiro evento (`evento_os`) cujo `responsavel` não é `sistema`**
  (ordenação por `data_hora ASC`). OS sem responsável humano cai em `sistema` (explícito).
- Receita da OS = `SUM(conta_receber.valor)` não cancelado (alinhado ao DRE); custo =
  `SUM(produto.custo)` de armação + lente da OS. Evita dupla contagem na receita.
- **Efeito colateral aceito:** enquanto o cadastro da OS registrar `responsavel = sistema` na
  criação, o relatório agrupa em `sistema`. É um problema de captura de dado, não de cálculo —
  o agregador já está correto e passa a enriquecer quando o frontend enviar `responsavel`.

### D3 — Curva ABC: faixas 80/95 sobre % acumulado por faturamento
- Ordena produtos por faturamento desc (desempate por nome asc).
- `participacaoPercentual` = faturamento/total; `percentualAcumulado` = soma corrente (exata).
- Classe: acumulado exato ≤ 80% → A; ≤ 95% → B; > 95% → C. Sem faturamento no período →
  todos C com 0% (nada a rankear).
- BigDecimal HALF_EVEN; exibição com 2 casas; decisão de faixa com precisão 10 casas
  (intermediário), nunca sobre o valor arredondado de 2 casas.

### D4 — Sem view no banco; só índices (V30)
- View criada por owner superuser ignora RLS das tabelas base (BYPASSRLS) → risco real de
  vazamento entre tenants. As queries nativas filtram `loja_id` explicitamente + dependem da
  segunda barreira RLS FORCE nas tabelas base. Migration `V30__relatorios_bi.sql` adiciona
  apenas índices idempotentes (`ordem_servico(loja_id,status,criado_em)`,
  `conta_receber(ordem_servico_id) WHERE ativo AND status<>CANCELADO`).

### D5 — Período
- Parâmetros `dataInicio`/`dataFim` (LocalDate). Default: mês atual (`01` até hoje), mesmo
  comportamento do DRE. Conversão para `timestamptz` em `America/Sao_Paulo`
  (`fimExclusivo = dataFim+1 dia à 00:00`). `fim < inicio` → `IllegalArgumentException`
  (400 via ProblemDetailHandler).

## Consequências
- Módulo novo `com.visionbox.modules.relatorios` com `repository → service → dto → controller`
  (+ agregadores puros `MargemVendedorAggregator` e `CurvaAbcClassifier`, testáveis via
  Mockito/JUnit sem SQL).
- RBAC: `GET /api/v1/relatorios/**` → ADMIN/GERENTE/FINANCEIRO.
- Não altera `financeiro`/`ordemservico` — apenas leitura via queries nativas no módulo de
  relatorios.