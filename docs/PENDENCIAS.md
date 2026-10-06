# VisionBox — Tudo que Falta (pós S1 cru)

> **Gerado em:** 2026-09-05 16:20 | **Base:** `visionbox-especificacao.md` + `arquivo.md` + estado atual `S0 100% + S1 25%` (Auth + Cliente/Produto/OS CRUD, frontend API real mas cru)
> **Objetivo deste arquivo:** listar sem filtro o que ainda está cru/incompleto para chegar no MVP S1→S3 redondo. Fonte para `BACKLOG.md` e `PROGRESS.md`.

## Snapshot cru atual

- Backend sobe em `8080` com `ddl-auto: create`, Auth `admin/admin123` ok, mas `Cliente/Produto/OS` sem validações óticas, sem estoque/financeiro/fiscal real, sem seed rico.
- Frontend sobe em `5173` com Login + Kanban/PDV/Clientes/Catalogo ligados na API real, mas UI sem máscaras, sem upload, sem timeline completa, sem estados polidos.

## BACKLOG restante (17 US) — status cru

| US | Título | Status cru | O que falta |
|---|---|---|---|
| **US01** | Cliente + Receita (foto ESF/CIL/EIXO OD/OE) | 🟡 cru | Receita entity existe mas sem `GrauOlho` cipher display, sem validação `cil≠0 → eixo 0-180`, sem `dataValidade` recall, sem upload S3 presigned, sem ViaCEP, sem consentimento_recall UI |
| **US02** | Armação/Lente com SKU/barras | 🟡 cru | Produto existe mas sem `NCM/CEST/CFOP`, sem `ean`, sem `marca/categoria` FK, sem busca `<500ms` com `pg_trgm`, sem validação `UNIQUE(loja,sku)` UI |
| **US03** | Import CSV | 🔴 não iniciado | Template + erro linha-a-linha, `cpf_hash` dedup |
| **US04** | Orçamento → OS 1 clique, desconto alçada | 🔴 não iniciado | `Orcamento/PedidoVenda` entity, cálculo `BigDecimal HALF_EVEN`, desconto >15% senha gerente, transformer `Orçamento→OS` |
| **US05** | PIX/cartão/crediário Nx parcelas | 🔴 não iniciado | `ContaReceber` existe mas não gera parcelas ao fechar OS, sem `forma_pagamento` enum, sem `tPag=17` PIX |
| **US06** | Mover OS 12 status com log | 🟡 cru | `TransicaoOSRegistry` ok + `EventoOS` mas sem guard `ENVIADO exige armação/lente` na UI, sem `Timeline` com `dataHora/responsável/metadata`, sem `422` UI |
| **US07** | Kanban/Lista OS com SLA vermelho | 🟡 cru | Kanban mostra 5 col mas dados reais vazios (seed pobre), sem filtro `loja/vendedor/atraso`, sem `previsaoEntrega <24h` vermelho, sem `idx_os_atrasadas` |
| **US08** | WhatsApp PRONTO | 🔴 não iniciado | Botão `wa.me` com mensagem pronta |
| **US09** | Estoque reserva/baixa/estorno | 🟡 backend cru | `EstoqueService` existe mas não é chamado ao `criar OS` (reserva) nem `avancar(ENTREGUE)` (baixa), sem `CHECK quantidade>=0` UI |
| **US10** | Portal Lab token | 🔴 não iniciado | — Fase 2 |
| **US11** | Fila produção + CQ com foto | 🔴 não iniciado | — Fase 2 |
| **US12** | WhatsApp auto | 🔴 não iniciado | — Fase 2 |
| **US13** | Contas Receber/Pagar + DRE | 🟡 cru | `ContaReceber` existe mas sem OFX, sem DRE por loja/OS |
| **US14** | Régua cobrança | 🔴 não iniciado | — Fase 3 |
| **US15** | Campanha 1 ano + NPS | 🔴 não iniciado | — Fase 3 |
| **US16** | BI giro/margem/ABC | 🔴 não iniciado | — Fase 4 |
| **US17** | Portal cliente PWA | 🔴 não iniciado | — Fase 4 |

## Frontend cru — polimento

- [ ] **Máscaras/Validação:** CPF `***.***.***-**`, CEP 8 dígitos ViaCEP, `esferico -30..30`, `cil -10..0`, `eixo 0-180` obrigatório se `cil≠0`, `adicao 0..6` só MULTIFOCAL
- [ ] **Upload receita:** `Drag&Drop` → `POST /receitas/{id}/anexo/presigned → PUT S3 → PATCH s3Key` + preview + 5MB limite + ClamAV (mock)
- [ ] **PDV teclado-first:** `F2` cliente focus, `F4` SKU `Enter` adiciona, `+/-` qtd, `F8` Finalizar sempre ativo offline, `Idempotency-Key` header visível no Network, `X-Loja-Id` auto
- [ ] **Estados:** toda tela `Skeleton`/`Empty`/`Error` (`ProblemDetail` field errors) / `OfflineBanner` + `SyncIndicator` 3 pendentes + `aria-live`
- [ ] **Design system:** nenhum `hex` no JSX (só `var(--color-*)`), `darkMode: selector [data-theme="dark"]`, `focus-visible` 2px primary, contraste AA `axe` 0
- [ ] **Timeline OS:** vertical dots `status-*` + `EventoOS` auditável + `SlaIndicator` + `StatusTransitionModal` com `observação obrigatória` se `RETRABALHO`
- [ ] **Login/Logout:** `POST /auth/login` já ok, falta `refresh` httpOnly + `logout` + `me` no header + RBAC `hasAuthority` esconder botão

## Backend cru — regras

- [ ] **CpfConverter:** `cpf_cipher bytea` já criptografa mas `Cliente` ainda salva `cpf` plain se `cpfHash` não for usado; falta `AttributeConverter` no `Cliente` + `cpf_hash UNIQUE(loja,hash)` dedup UI
- [ ] **Receita:** `od_cipher/oe_cipher` bytea existe mas service não criptografa `GrauOlho`; falta `CryptoService` no `ReceitaService`
- [ ] **Produto:** `ncm String(8)` mas sem validação `NCM 9003/9004`, `cest`, `cfop 5102/5405`, `tributacao_regra(NCM+UF+CRT)` nunca hard-code
- [ ] **Moeda:** `BigDecimal(12,2) HALF_EVEN` já em `ContaReceber` mas `PedidoVenda` ainda usa `double` em alguns DTOs
- [ ] **Multi-tenant:** `loja_id` em todas as tabelas ok, mas `EntidadeBase` sem `@TenantId` em dev (removido pra subir) — precisa reativar com resolver `HS256` em prod + `RLS FORCE` `V11` (já criado mas não testado com `SET LOCAL`)
- [ ] **Outbox/Idempotency:** tabelas existem mas `PedidoVendaController` ainda não persiste `IdempotencyKey` + `outbox_message` na mesma transação; falta `IdempotencyFilter` replay + `OutboxPoller` → RabbitMQ
- [ ] **Seed:** `data.sql` só tem 1 loja + 1 admin + 3 produtos + 1 cliente; falta 20 produtos com `modelo3dUrl`, 5 clientes, 10 OS em status variados pra Kanban não ficar vazio

## Infra/QA cru

- [ ] **Testes:** `StatusOSTransicaoTest 51/51` ok mas `IsolamentoTenantTest`/`IdempotenciaPDVTest` ainda pulados no `.\mvnw test` (só `verify -Pintegration` com Docker 1.40+); falta `FiscalMoedaTest HALF_EVEN` + `CpfConverterTest` já ok + `ReceitaGrauValidatorTest`
- [ ] **CI:** `.github/workflows/ci.yml` existe mas não roda `flyway validate` em `create` mode; precisa `postgres:15-alpine` + `reuse` + `trivy` + `axe` no frontend
- [ ] **Observabilidade:** `Micrometer` métricas `visionbox_os_atrasadas` + `SlaMetrics` ainda não expostas; `Grafana` dashboard SLA/outbox/fiscal pendentes
- [ ] **Docker:** `docker-compose.dev.yml` ok mas `app` service não sobe junto (só `postgres/redis/rabbit/minio`); falta `app` build `distroless` + `HEALTHCHECK`

## Dívida S0 deixada cru

- `V1/V2/V11` Flyway + `ddl-auto: create` em dev = diverge; prod precisa voltar pra `validate` + `V12..V14` (`usuario`, `estoque`, `financeiro`, `documento_fiscal`) já gerados mas não migrados via Flyway
- `EntidadeBase` sem `@TenantId` em dev — reativar antes de Fase 2 ou vazamento `R8` volta
- `application-dev.yml` com `ddl-auto: create` apaga dados a cada restart — trocar pra `update` após seed estabilizar

## Próximos 3 passos para sair do cru (ordem)

1. **S1-01 polimento** — máscaras + ViaCEP + validações `GrauOlho` + upload S3 presigned (2d)
2. **S1-02 fluxo** — `EstoqueService.reservar` ao `criar OS` + `ContaReceber.gerar` ao `avancar(PEDIDO_CONFIRMADO)` + seed rico 10 OS (1d)
3. **S1-03 E2E** — `.\mvnw test` 51/51 + `IsolamentoTenantTest` em CI + `k6/pdv-smoke.js` p95<300ms + `Login → Cria Cliente → Cria OS → Kanban` sem 401 (1d)

> Atualize `BACKLOG.md:17` Status `cru → doing → done` + `PROGRESS.md:1` burndown + `state.json:progress_pct` a cada entrega. Critério para sair do cru: `mvn verify -Pintegration` verde + `npm run build` + Kanban com dados reais sem `EmptyState` forçado.
