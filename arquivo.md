# VisionBox — Plano Executivo Consolidado

> **Produto:** `VisionBox` — ERP vertical para óticas (TECHBOXBR: Outbox, Pointbox, Finbox, Cashbox)
> **Fonte canônica:** `visionbox-especificacao.md` (387 linhas) + `theme-visionbox.css` (144 linhas)
> **Stack alvo:** Java 17 LTS + Spring Boot 3.x + Spring Data JPA/Hibernate 6 + PostgreSQL 15+ + Flyway + MapStruct + Spring Security JWT + RabbitMQ + Redis + Quartz + S3/MinIO + React+Tailwind (OUTBOXERP)
> **Data:** 05/09/2026
> **Agentes consultados:** Product Manager, Backend Engineer, DB Admin, Frontend Engineer, Fiscal Engineer, Security Auditor/Compliance, QA Engineer, DevOps Infra — todos com entrega concluída

---

## Índice

1. [Tese e North Star](#1-tese-e-north-star)
2. [Visão, Personas e Proposta de Valor](#2-visão-personas-e-proposta-de-valor)
3. [Comparativo de Mercado](#3-comparativo-de-mercado)
4. [Roadmap 4 Fases e MVP Fechado](#4-roadmap-4-fases-e-mvp-fechado)
5. [Backlog S0–S3](#5-backlog-s0s3)
6. [Arquitetura Backend](#6-arquitetura-backend)
7. [Modelagem JPA Refinada](#7-modelagem-jpa-refinada)
8. [Máquina de Estados OS](#8-máquina-de-estados-os)
9. [Multi-tenant loja_id](#9-multi-tenant-loja_id)
10. [Modelagem Física PostgreSQL (V1–V11)](#10-modelagem-física-postgresql-v1v11)
11. [Fiscal NFC-e/NF-e 4.00 e Contingência](#11-fiscal-nfce-nfe-400-e-contingência)
12. [Frontend e Design System](#12-frontend-e-design-system)
13. [Modo Offline / PWA](#13-modo-offline--pwa)
14. [Segurança, Criptografia e LGPD](#14-segurança-criptografia-e-lgpd)
15. [QA — Estratégia e Casos Críticos](#15-qa--estratégia-e-casos-críticos)
16. [DevOps, Docker, CI/CD e Observabilidade](#16-devops-docker-cicd-e-observabilidade)
17. [Riscos e Mitigações](#17-riscos-e-mitigações)
18. [Decisões (ADRs) e Próximos Passos](#18-decisões-adrs-e-próximos-passos)
19. [Checklists Executáveis](#19-checklists-executáveis)

---

## 1. Tese e North Star

Uma ótica é **varejo + serviço de saúde + manufatura sob encomenda** (`visionbox-especificacao.md:10-14`). Fluxo Comercial → Produção/OS → Financeiro/Relacionamento. Sistemas de mercado resolvem PDV e financeiro, mas tratam OS como observação em texto livre sem rastreabilidade (`visionbox-especificacao.md:16`).

**North Star Metric:** `OS Entregues no Prazo / mês / loja`. Proxy de valor: vendeu, produziu e entregou sem atraso e com margem.

**Regra de ouro:** nunca inventar alíquota. Toda tributação vem de `tributacao_regra(NCM+UF+CRT)` parametrizável; código só calcula.

---

## 2. Visão, Personas e Proposta de Valor

**Visão 3 anos:** ser o SO operacional da ótica independente brasileira — da venda ao laboratório e ao caixa, sem planilha, com rastreio no WhatsApp.

**Personas:**
- **Dono/Gestor:** quer DRE, margem por OS, inadimplência, giro.
- **Vendedor/Consultor:** quer orçamento em 2 cliques com receita digitalizada.
- **Laboratorista:** quer fila de produção sem perguntar "cadê a OS 123?" no WhatsApp.

| Dor latente | Concorrente | VisionBox (diferencial) |
|---|---|---|
| "Onde está meu óculos?" | Cliente liga na loja | Rastreio OS + WhatsApp automático por status (`visionbox-especificacao.md:267-274`) |
| Lente errada / retrabalho | OS em papel sem validação ESF/CIL/EIXO | Validação coerência `GrauOlho` + trava Lente x Grau |
| Caixa não bate | PDV desconectado de OS/crediário | PDV baixa OS + financeiro nativo por parcela/OS |
| Estoque fantasma | Controle manual | Reserva por OS, alerta ponto de pedido |

---

## 3. Comparativo de Mercado

| Capacidade | VisionBox Alvo | Ótica Fácil / SóOtica | Genéricos (Tiny+Excel) |
|---|---|---|---|
| PDV+Orçamento→OS 1 clique | Nativo | Bom mas telas separadas | Genérico sem receita |
| Máquina 12 status auditável | 12 status + SLA | 5–7 status simples | Não tem |
| Integração laboratório | API/webhook + fallback PDF | Manual e-mail/telefone | Não tem |
| Recall receita vencida | Job auto por `dataValidade` + canal preferido | Raro/manual | Não tem |
| Multi-loja | Nativo com transferência estoque | Pago à parte mal integrado | Não tem |
| Prova virtual WebAR | Opcional `modelo3dUrl` (`visionbox-especificacao.md:216`) | Inexistente | Não tem |
| Fiscal NFC-e/NF-e + offline | Presente + contingência outbox | Presente | Presente genérico |
| BI SLA lab | Dashboard tempo médio por lente | Relatórios estáticos | Não tem |

---

## 4. Roadmap 4 Fases e MVP Fechado

| Fase | Nome (spec §8) | Outcome | OKR | Métrica 90d |
|---|---|---|---|---|
| **F1** | Fundação Comercial+OS Core (S0–S8) | Vender sem planilha | Orçamento <3min | >150 OS/loja/mês, <5% perdidas |
| **F2** | Produção & Lab (S9–16) | Lab previsível | Eliminar "cadê OS?" | Lead time -30%, 100% auditável |
| **F3** | Financeiro & Relacionamento (S17–24) | Lucro e recompra visíveis | Fechar caixa <10min | Inadimplência <4%, recompra 12m >18% |
| **F4** | Inteligência & Escala (S25+) | Decisão por dados | 70% lojas no BI | LTV +25% |

### F1 — Épicos Must (MVP loja única)

- **F1-E1 Cadastro & Receita:** US01 cliente+receita (valida -20..+20, cil 0..-6, foto obrigatória), US02 armação/lente com SKU, US03 import CSV.
- **F1-E2 Orçamento→Venda PDV:** US04 orçamento→OS 1 clique, desconto >15% exige senha, US05 PIX/cartão/crediário gerando títulos.
- **F1-E3 Máquina OS 12 status:** `ORCAMENTO → PEDIDO_CONFIRMADO → ENVIADO_LABORATORIO → EM_PRODUCAO → LENTE_PRONTA → MONTAGEM → CONTROLE_QUALIDADE → PRONTO_PARA_RETIRADA → ENTREGUE (+ CANCELADO, DEVOLVIDO_GARANTIA, RETRABALHO)` — transição validada, `EventoOS` imutável, Kanban com SLA vermelho, botão `wa.me` manual.
- **F1-E4 Estoque reserva:** ao aprovar OS cria "Reservado", baixa só em `ENTREGUE`.

### O que NÃO entra no MVP (MoSCoW)

| Pedido | Decisão | Por quê |
|---|---|---|
| Financeiro DRE/OFX | F3 | Atrasaria MVP 4 sprints |
| Portal laboratório | F2 | Exige auth externa |
| WhatsApp automático | F2 (manual no MVP) | Custo/homologação Meta |
| App cliente / e-commerce | F4 | Desvia foco B2B |
| Surfaçagem bloco | F2 | Só 15% surfaçam |
| NFS-e | F4 | Município distinto |

**Definição de pronto MVP:** 5 óticas piloto criam 50 clientes, 20 orçamentos, 15 OS até `ENTREGUE` e fecham caixa sem planilha. 70% OS criadas chegam a `ENTREGUE` em 14d.

---

## 5. Backlog S0–S3 (sprints 2 sem, squad 1 PO + 2 devs + 1 QA + 1 UX part-time)

**S0 Foundation:** setup CI/CD+auth+`loja_id`, Event Storming OS, protótipo Figma Orçamento→Kanban validado com 3 óticas, contrato CSV, env homolog com 200 OS fake.

**S1 Cadastro & Orçamento:** US01 Cliente+Receita foto, US02 Produto/código barras <500ms, US04 criar orçamento.

**S2 Conversão e Máquina:** US04 converter Orçamento→OS, US06 StateMachine+log, US07 Kanban+Filtros+SLA, US05 recebimento à vista.

**S3 Estoque+Financeiro simples:** US09 reserva/baixa, US05 crediário parcelas, US08 botão WhatsApp `PRONTO`, US03 CSV, perf 5k SKUs.

S4–5 piloto + hardening, S6 lançamento beta 10 lojas.

---

## 6. Arquitetura Backend

```
com.visionbox
├── config/              # Security, CORS, OpenAPI, Rabbit, Redis, Quartz, Auditoria
├── shared/              # EntidadeBase, TenantContext, Outbox, Idempotency, ProblemDetail, utils
├── modules/
│   ├── pessoa/          # Cliente/Fornecedor
│   ├── clinico/         # Receita/GrauOlho
│   ├── catalogo/        # Produto single-table Armacao/Lente + Marca/Categoria
│   ├── estoque/         # Estoque/Movimentacao/Transferencia
│   ├── compras/         # PedidoCompra
│   ├── vendas/          # Orcamento/PedidoVenda/PDV
│   ├── ordemservico/    # OS + EventoOS + StateMachine
│   ├── laboratorio/     # Integração lab
│   ├── financeiro/      # ContaReceber/Pagar/FormaPagamento/Comissao
│   ├── convenio/        # Convenio/TabelaReembolso
│   ├── fiscal/          # NFC-e/NF-e contingência
│   ├── crm/             # Recall/campanhas
│   ├── agenda/
│   ├── usuario/         # RBAC
│   └── relatorios/
└── api/                 # Controllers REST
```

Padrão por módulo: `domain(entity,repository) → service(@Transactional) → mapper(MapStruct) → dto(Request/Response + Jakarta Validation) → controller → event(Spring Events + RabbitMQ outbox)`. Controller nunca expõe entidade.

---

## 7. Modelagem JPA Refinada

**EntidadeBase corrigida (spec §4.1 + prod):** `UUID gen_random_uuid()`, `loja_id NOT NULL`, `OffsetDateTime timestamptz` (não LocalDateTime), `@Version` 409 em conflito, `ativo` soft-delete via `@SQLRestriction`, `@TenantId` Hibernate 6.4+.

**Produto single-table:** `idx_prod_loja_sku unique(loja_id,sku)`, `ncm String(8)` (não BigDecimal), `BigDecimal(12,2)` preço com `HALF_EVEN`. Se >30 colunas esparsas, migrar para `JOINED` em Fase 3.

**Receita:** `GrauOlho` embeddable com `@AttributeOverride(od_/oe_)`, `BigDecimal esferico/cilindrico`, `eixo 0-180`, `dp`, `anexoS3Key String` (nunca `byte[]` no PG), validação `@AssertTrue` coerência + índice `idx_rec_validade(dataValidade)`.

**OrdemServico:** `numero OS-2026-00123` via `sequencia_os(loja_id,ano)` com `pg_advisory_xact_lock`, índices `idx_os_loja_num unique`, `idx_os_status`, `idx_os_previsao`; `historico @OneToMany(cascade ALL, orderBy dataHora)` + `optimistic lock`. `EventoOS` com `jsonb metadataJson`, índice `(ordem_servico_id,data_hora)`.

---

## 8. Máquina de Estados OS

**Escolha:** Enum + Registry Pattern (Map de transições) — sem Spring StateMachine (pesado) e sem tabela DB-driven pura. Tabela de transições é documentação/BI, validação fica no código.

```java
enum StatusOS { ORCAMENTO, PEDIDO_CONFIRMADO, ENVIADO_LABORATORIO, EM_PRODUCAO, LENTE_PRONTA, MONTAGEM, CONTROLE_QUALIDADE, PRONTO_PARA_RETIRADA, ENTREGUE, CANCELADO, DEVOLVIDO_GARANTIA, RETRABALHO }

PERMITIDAS = Map.of(
  ORCAMENTO, Set.of(PEDIDO_CONFIRMADO,CANCELADO),
  PEDIDO_CONFIRMADO, Set.of(ENVIADO_LABORATORIO,CANCELADO),
  ENVIADO_LABORATORIO, Set.of(EM_PRODUCAO,RETRABALHO,CANCELADO),
  EM_PRODUCAO, Set.of(LENTE_PRONTA,RETRABALHO),
  LENTE_PRONTA, Set.of(MONTAGEM),
  MONTAGEM, Set.of(CONTROLE_QUALIDADE,RETRABALHO),
  CONTROLE_QUALIDADE, Set.of(PRONTO_PARA_RETIRADA,RETRABALHO),
  PRONTO_PARA_RETIRADA, Set.of(ENTREGUE,DEVOLVIDO_GARANTIA),
  RETRABALHO, Set.of(ENVIADO_LABORATORIO,EM_PRODUCAO)
);
```

`OrdemServicoService.avancar()` valida registry + guards (ex: exige armação+lente para `ENVIADO_LABORATORIO`), cria `EventoOS`, publica `StatusOSAlteradoEvent` (`@TransactionalEventListener AFTER_COMMIT → outbox → RabbitMQ`). SLA calculado `hoje + prazoLab(TipoLente)+1d`, job `VerificaAtrasoOSJob` (`@DisallowConcurrentExecution` + Redis `SETNX visionbox:sla:lock`) dispara `SlaRiscoEvent` → WhatsApp gerente.

---

## 9. Multi-tenant `loja_id`

Estratégia recomendada: `@TenantId` + `CurrentTenantIdentifierResolver` lendo `TenantContext(ThreadLocal)` populado por `TenantFilter` após JWT (`claim loja_id` validado, nunca header sem validar). Fallback `@FilterDef(lojaFilter)` + `enableFilter`. Repositórios sempre `findByIdAndLojaId`, nunca `findById` puro. Fail-closed se `lojaId==null`. Defesa profunda: **RLS** `CREATE POLICY loja_isolation USING (loja_id = current_setting('app.loja_id')::uuid)` + `SET LOCAL` por conexão. Evolução schema por tenant via `hibernate.multiTenancy=SCHEMA` + `MultiTenantConnectionProvider(SET search_path)` só para enterprise Fase 4.

---

## 10. Modelagem Física PostgreSQL V1–V11

**Princípio:** `UUID PK gen_random_uuid()`, `timestamptz`, `numeric(12,2)` financeiro / `numeric(12,4)` grau, `loja_id` em todas exceto `loja`, `versao`, `ativo`, índices compostos `loja_id` primeiro, partição RANGE mensal em tabelas de volume.

**V1 baseline:** `pgcrypto, uuid-ossp, pg_stat_statements, pg_trgm, btree_gin`, enums `perfil_enum/status_os/tipo_produto`, `loja`, `sequencia_numeracao(loja_id,tipo,ano)`.

**V2 usuario:** `perfil`, `usuario`, `usuario_loja N:N`, `idx_usuario_loja_email WHERE ativo`.

**V3 cliente (LGPD):** `cliente(cpf_crypt bytea, cpf_hash varchar64 unique, hash sha256 para busca)`, `cliente_contato`, `cliente_endereco`, `GIN pg_trgm` para busca nome.

**V4 receita:** `receita(data_validade, observacao_crypt bytea)`, `grau_olho(OD/OE, esferico -30..30, eixo 0-180)`, `idx_receita_revalidade` e `idx_receita_vencida` para recall.

**V5 produto:** `marca, categoria, produto single-table(tipo, sku unique por loja, ncm String, cest, preco_venda/custo)`, `GIN busca`, `idx_produto_recall(lote,data_validade)`, `idx_produto_sku_covering INCLUDE(nome,preco_venda)`.

**V6 laboratorio/convenio/pedido:** `laboratorio(prazo_medio_dias)`, `convenio`, `pedido_venda` particionado `RANGE(criado_em)` PK `(id,criado_em)`, `pedido_item` FK partição-aware.

**V7 OS:** `ordem_servico` particionada + `evento_os`, índices SLA `idx_os_atrasadas WHERE status NOT IN ('ENTREGUE','CANCELADA') AND prazo_entrega<now()`, `BRIN(criado_em)`, `fillfactor 85`.

**V8 estoque:** `estoque(loja_id,produto_id PK, quantidade,reservado)`, `estoque_lote(lote,validade)` recall, `movimentacao_estoque` particionada.

**V9 financeiro:** `forma_pagamento`, `conta_receber/pagar` particionadas + `idx_cr_vencidos`.

**V10 outbox/idempotency/auditoria:** `outbox(PENDENTE/ENVIADO/ERRO, proxima_tentativa)`, `idempotency_key(chave PK, loja_id, expira_em)`, `log_auditoria` particionada + `BRIN`, `REVOKE UPDATE/DELETE`.

**V11 RLS:** `ENABLE/FORCE ROW LEVEL SECURITY` em todas exceto `loja/sequencia`, policies `loja_isolation`, roles `app_pdv/app_api/app_readonly/archival_job BYPASSRLS`.

**Tuning PDV concorrência:** `shared_buffers 8GB, effective_cache 24GB, work_mem 16MB, max_connections 200 + PgBouncer transaction`, `pg_advisory_xact_lock` para sequências, `fillfactor 85`, `batch_fetch 50`.

**Backup/Replicação/Archival:** `pgBackRest` base diária + WAL 5min para S3 criptografado, RPO 15m RTO 1h, streaming replica sync+async com `Patroni`, `DETTACH partition >60m → S3 Glacier`.

---

## 11. Fiscal NFC-e/NF-e 4.00 e Contingência

**Escopo MVP balcão B2C:** `NFC-e 65 CFOP 5.102/6.102` padrão 90% casos; `5.405/6.405` se ST com CEST; `NF-e 55` para PJ/transferência. Nunca NFS-e no MVP. NCMs: `9003.11.00/9003.19.00 armação`, `9001.50.00 resina`, `9001.40.00 vidro`, `9004.10.00 sol`, `CEST 28.036/28.038` condicional por UF.

**Gateway:** `FiscalProvider {emitir, consultar, cancelar, inutilizar}` com impl `Focus/NuvemFiscal/SefazDireto`. MVP começar com **Nuvem Fiscal/Focus** (2–5d homologação) atrás de interface; Fase 3 migrar para `SefazDireto` para contingência 100% offline e custo zero.

**DDL fiscal (V10):** `sequencia_fiscal(loja,modelo 55/65,serie,ambiente 1/2)`, `faixa_numeracao_offline(pdv, n_inicio/fim)` 500 nums/PDV, `documento_fiscal(status RASCUNHO→AUTORIZADO/REJEITADO/CONTINGENCIA, tipo_emissao 1/6/7/9, chave 44, xml, protocolo, qrcode)`, `documento_fiscal_item(snapshot CFOP/NCM/CST, base/aliquota ICMS, IBPT)`, `documento_fiscal_evento`, `outbox_fiscal`, `tributacao_regra(uf_origem,uf_destino,ncm,crt,cfop,cst, aliquota)`. CRT 1 Simples → `CSOSN 102/500/400`, CRT 3 Normal → `CST 00/40/60`, `tPag 17 PIX`.

**Cálculo tributário:** `TributacaoService` busca `tributacao_regra`, nunca hardcode 18%. IBPT obrigatório `vTotTrib`.

**Fluxo online:** PDV `POST /emitir-nfce` → reserva sequência `SELECT FOR UPDATE` → gera `RASCUNHO` + XML 4.00 assina A1 (Vault) → `outbox_fiscal` na mesma transação → `fiscal.emissao` Rabbit → SEFAZ SOAP `NFeAutorizacao4` (5s timeout retry 3x) → `AUTORIZADO` + QR `hashCSRT` → imprime ESC/POS 80mm.

**Contingência offline (padrão OUTBOXERP):** `socket/503/999 3x` → Redis `sefaz:status=OFFLINE` → `tpEmis=9` FS-DA com faixa pré-alocada IndexedDB, assina local, `PENDENTE_CONTINGENCIA`, DANFE tarja, `fiscal.contingencia` Rabbit com backoff `1m*2 até 1h` até 24h, SVC-AN `tpEmis=6` fallback, job alerta `-20h`.

---

## 12. Frontend e Design System

**Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind 3.4 + React Router 6 + Zustand (client) + TanStack Query v5 (server) + RHF+Zod + shadcn/ui + Dexie + Workbox PWA. Escolha React reaproveita SO OUTBOXERP e WebAR.

**Estrutura:**
```
apps/web/src/{app,config,lib,styles/theme-visionbox.css,components/ui|layout|feedback,features/{auth,cliente,receita,catalogo,vendas,os,financeiro},hooks,stores,services/api|offline,workers}
```

**Tokens:** importar `theme-visionbox.css` sem duplicar hex; Tailwind `darkMode: [selector,'[data-theme="dark"]']` estendendo `colors.primary: var(--color-primary)` etc. Shadcn variants com `bg-primary hover:bg-[var(--color-primary-dark)]`. Regra: nunca hex no JSX.

**Dark mode:** `html[data-theme="dark"]` usa variações escuras da paleta boutique marrom/areia, store `localStorage`, toggle header `Sun/Moon`, transição `.2s`.

**Semáforo OS (classes `.status-*`):** usar somente tokens `--color-info-light`, `--color-warning-light`, `--color-primary-light`, `--color-success-light` e `--color-danger-light`, com texto pelos respectivos tokens escuros. Componente `<OSStatusBadge>` com ícone lucide + label (não só cor).

**Acessibilidade AA:** contraste 4.5:1 validado `axe-core` CI, `focus-visible` 2px `primary`, PDV teclado-first `F2 cliente F4 busca F8 finalizar ESC cancelar`, `aria-live` SyncIndicator.

**Telas MVP wireframe:**
- **Login:** card 400px, RHF+Zod, ProblemDetail banner, offline permite token cache 24h, `GET /usuarios/me` perfis.
- **Dashboard Kanban:** métricas atrasadas/em produção/prontas/SLA médio, 5 colunas drag disabled, card `OS-2026-00123 + cliente + previsão warning <24h`, polling 30s.
- **Cliente+Receita:** abas Dados/Receitas/OS/Financeiro, ViaCEP, LGPD checkbox consent recall, modal Grau OD/OE validação eixo só se cilíndrico, upload `POST /presigned → PUT S3 → PATCH s3Key`.
- **Catálogo:** filtros tipo/marca/material, grid 4x3, covering index SKU, drawer specs `modelo3dUrl`.
- **PDV:** 65% busca+carrinho | 35% cliente+resumo, `PdvCartStore` Zustand+IndexedDB, debounce 150ms, `<16ms` local, `MoneyInput` BRL, finalização gera `PedidoVenda+OS`.
- **Timeline OS:** linha vertical dots coloridos, `EventoOS` + SLA risco, modal transição só status permitidos, toggle notificar WhatsApp.
- **Financeiro:** `ContaReceber/Pagar`, caixa do dia, baixa com multa/juros.

Cada tela tem `Skeleton/Empty/Error(ProblemDetail Retry)/Offline`.

---

## 13. Modo Offline / PWA

```
PDV online → POST /vendas → 201 + nfeStatus=AUTORIZADA
PDV offline → Dexie.outbox.add({id:uuid,type:CREATE_VENDA,payload,status:PENDING}) → toast TEMP-001
SyncEngine (30s + onLine + Background Sync) → POST /vendas com Idempotency-Key → 201→SYNCED | 409→CONFLICT modal | 422 valida preço/estoque
Backend Outbox (Postgres) → RabbitMQ → Worker Fiscal tenta SEFAZ
```

Dexie `outbox(id,type,status,createdAt) + produtosCache/clientesCache/sequenciaTemp`. Numeração offline `OS-2026-TEMP-{uuid8}` trocada por definitiva ao sync. Workbox precache shell, runtime cache `GET /catalogo StaleWhileRevalidate 1h`. Nunca `localStorage` para fila, nunca NF-e no client, botão Finalizar sempre ativo. Prova virtual Fase 3 `MediaPipe FaceMesh + Three.js glTF` lazy, portal cliente `portal.visionbox.com.br` magic link CPF+OTP.

**Integração API:** `axios` + `openapi-typescript` gerado, interceptor JWT+`Idempotency-Key: crypto.randomUUID()`, normaliza `ProblemDetail {type,title,status,detail,errors}`, TanStack `stale 30s`, `<Can I="os:write">` RBAC UI mas autoridade é backend.

---

## 14. Segurança, Criptografia e LGPD

**Achados críticos (auditoria OWASP 2025/ASVS 4.0/ISO 27001/LGPD):**

| ID | Gap | Severidade | Correção |
|---|---|---|---|
| C-01 | `loja_id` discriminator sem enforcement → IDOR | Crítica | `EntidadeBase loja_id NOT NULL + @TenantId + TenantFilter JWT + RLS + teste CrossTenant` |
| C-02 | CPF `String plain` + `GrauOlho Double plain` | Crítica | `cpf_cipher bytea + cpf_hash HMAC sha256 unique(loja_id,cpf_hash)`, `od_cipher/oe_cipher bytea AES-GCM`, nunca plain |
| C-03 | `pgcrypto` indefinido com CVE-2026-2005 RCE | Crítica | Escolher **Converter AES-GCM app-side + HMAC**; PG≥15.16 se usar `hmac()`; KEK em Vault/KMS |
| A-01 | RBAC só lista perfis sem matriz recurso | Alta | Matriz `VENDEDOR/OTICO/GERENTE/FINANCEIRO/ADMIN` × `RECEITA/OS/FINANCEIRO`, `@PreAuthorize("hasAuthority('RECEITA_READ')")` + `TenantVoter` |
| A-02 | JWT refresh 7d sem rotation/revoke | Alta | access 15m memória + refresh 7d `httpOnly Secure SameSite=Strict Path=/auth/refresh`, rotation+reuse detection, Redis blacklist `jti` |
| A-03 | Validação Grau sem bounds → calc lente quebra | Alta | `@DecimalMin/Max`, `@Range eixo 0-180`, `@CPF`, MIME scan ClamAV, SSRF allowlist lab webhook |
| A-04 | Supply chain SBOM faltante | Alta | Pinar Boot≥3.4.16/3.5.14, `trivy + cyclonedx SBOM + Dependabot` |
| A-05 | `LogAuditoria` só escrita mutável | Alta | Append-only particionada, captação AOP read/write, `REVOKE UPDATE/DELETE`, `prev_hash/row_hash` chain |

**Converter conceitual:**
```java
@Converter class CpfConverter implements AttributeConverter<String,byte[]> {
 // [1B version][12B nonce][cipher][16B tag] AES-GCM, DEK por loja derivada HKDF(KEK+loja_id), KEK em Vault
}
// Busca: normaliza cpf → hmac_sha256(pepper,cpf) → where cpf_hash=:hash AND loja_id=:lojaId → decrypt só do hit
// Display VENDEDOR → ***.456.789-** ; ÓTICO/GERENTE → plain auditado
// Rotação: KEK v1→v2 RewrapJob recripta sem downtime; filas offline SQLCipher/EncryptedSharedPreferences
```

**DLD seguro:** RLS (`visionbox-especificacao.md:75`), `log_auditoria(ts,loja_id,usuario_id,acao READ/WRITE, recurso, diff_hash, ip, traceId, row_hash)`,SIEM `DENIED>5/5m → block`, backup `AES256 + Object Lock 5a`, logs mascarados `%replace cpf`, S3 `SSE-KMS + DenyUnencryptedUpload`, export `EXPORT_DADOS` só GERENTE.

**LGPD mapeada:**

| Dado | Classificação | Base art.7/11 | Retenção | Direito | Impl |
|---|---|---|---|---|---|
| CPF | Pessoal | Contrato+legal fiscal | 5a pós NF (CTN 174) | Anonimização | cipher+hash |
| GrauOlho/DP | Sensível saúde | Consentimento ou tutela saúde II f | 5a + anonimizado | Revogação | cipher, só ÓTICO/GERENTE |
| Contato recall | Pessoal | Consentimento I + legítimo IX opt-out | Até revogação | Excluir | `consentimento(finalidade=RECALL, canal, versao, revogado_em)` |
| Foto receita | Sensível | Consentimento | 5a | Exclusão | S3 Object Lock |

Exclusão ≠ DELETE se há OS com NF <5a: anonimiza `nome→ANONIMIZADO <hash>, cpf null, od/oe null` mantendo `loja_id+valor+NF`. DPIA obrigatório escala saúde + ROPA = `log_auditoria+consentimento`, DPO `privacy@visionbox.com.br`, incident runbook 72h ANPD.

---

## 15. QA — Estratégia e Casos Críticos

**Pirâmide:** Unit 70% JUnit5/Mockito, Integração 20% Testcontainers PG/Redis/Rabbit/MinIO, Contrato 7–10% Pact/Spring Contract, E2E 3–5% Playwright. Gates `JaCoCo ≥80% (≥95% OS/fiscal/estoque/clínico)`, `PIT ≥80%`.

**Críticos implementados:**

- **OS 12 status parametrizado:** `@CsvSource({ORCAMENTO→PEDIDO_CONFIRMADO true, ORCAMENTO→EM_PRODUCAO false, ENTREGUE→CANCELADO false, EM_PRODUCAO→RETRABALHO true})`, invariante `historico.size==transições`, `CANCELADO` só até `ENVIADO_LABORATORIO`, `RETRABALHO→EM_PRODUCAO` reinicia `previsao`.
- **Tenant leak:** `IsolamentoTenantTest` `lojaA não vê clienteLojaB` + query nativa + controller `GET /os/{id} X-Loja-Id lojaA →404`, Redis prefix `loja:{id}:cache`, S3 `loja-{id}/receitas/`.
- **Idempotência+Outbox:** `Idempotency-Key UUID` `UNIQUE(loja_id,key)` TTL 24h, duplo POST mesma key cria 1 venda, `awaitility` outbox `PENDENTE→vazio` após Rabbit.
- **Fiscal moeda:** `BigDecimal HALF_EVEN` `99.99*0.12=12.00`, validação `CHECK quantidade>=0`.
- **SLA:** `Clock.fixed` job atrasado dispara `alertaAtrasoDisparado` uma vez.
- **Concorrência:** dois `avancar()` simultâneos → 1 `OptimisticLockException` (`@Version`).

**Bordas óticas:** `cilíndrico sem eixo →400`, `esferico -30→400 range -20..20`, `adicao sem MULTIFOCAL→400`, `estoque 1 + 2 vendas→1 sucesso 1 EstoqueInsuficiente`, `OS ENVIADO→cancelar compensa estoque+financeiro+mensagem lab`, `CPF duplicado mesma loja bloqueia, outra loja permite`, `LGPD anonimizar`.

**Perf:** `k6 run pdv-duplo-clique.js` 50 VUs p95<300ms `http_req_failed<1%`, mutation `CONDITIONALS_BOUNDARY`.

---

## 16. DevOps, Docker, CI/CD e Observabilidade

**Dockerfile multi-stage:** `maven:3.9-eclipse-temurin-17` `dependency:go-offline` → `gcr.io/distroless/java17-debian12:nonroot` + `HEALTHCHECK /actuator/health`.

**docker-compose.dev.yml:** `postgres:15-alpine`, `redis:7-alpine`, `rabbitmq:3.13-management`, `minio`, `app` com `SPRING_PROFILES_ACTIVE dev` + `.env.dev` não commitado.

**CI/CD GitHub Actions:**
```yaml
on: push main/develop + PR
jobs:
 build-test: {flyway validate → unit (<30s) → verify Testcontainers (<4m) → pitest → sonar qualitygate}
 build-push: {docker buildx + trivy HIGH=0 → ghcr.io/techboxbr/visionbox:sha}
 deploy-staging: {kubectl set image + rollout + smoke Playwright + k6}
 deploy-prod: {blue/green prod}
```
Gates: `coverage + pit + trivy + smoke`.

**Observabilidade:** `management.endpoints prometheus`, `logging JSON {traceId,spanId,lojaId}`, métricas `visionbox_os_atrasadas_total{laboratorio}`, `visionbox_lab_leadtime_seconds(p50,p95)`, `visionbox_os_em_producao`. Dashboards Grafana SLA/PDV/multi-loja. Alertas `OSAtrasada>5 10m`, `Outbox>100 5m`, `FiscalContingencia>0 15m`. Tracing OTel → Tempo/Jaeger propagando `traceId` em Rabbit/S3.

**Backup/DR/Escala:** `pg_basebackup + archive_command aws s3 cp WAL`, base 7d WAL 30d mensal 12m Glacier, `restore-drill` mensal PITR `now()-1h` RTO<30m RPO<5m, replica `Patroni/CNPG` failover, HPA `cpu 70% p95 400ms`, rate-limit `Bucket4j Redis 100 req/min/loja`, read replica BI, índice `loja_id` + partição >50 lojas.

---

## 17. Riscos e Mitigações

| # | Risco | Mitigação A | Contingência B |
|---|---|---|---|
| R1 | Concorrente preço menor | Diferenciar rastreio WhatsApp+DRE por OS | Nicho lab próprio paga mais |
| R2 | Kanban 12 status complexo | S0 valida 3 óticas, flag 6 status simples | Feature flag simplificar |
| R3 | WhatsApp custo/bloqueio | MVP manual `wa.me`, F2 Cloud API Meta | Fallback SMS + link rastreio |
| R4 | CSV sujo 10 anos | Template + erro linha-a-linha | Concierge import 10 primeiras lojas |
| R5 | Ótica sem processo | Playbook BPMN VisionBox | Parceria implantação |
| R6 | Scope creep NF-e MVP | Integrar parceiro fiscal, não construir | Ter eNotas homologado |
| R7 | LGPD receita sensível | Cipher+RLS+audit+consentimento desde S0 | DPO + termo |

Top 3 semanal: Adoção Kanban, Win/Loss vs Ótica Fácil, Custo WhatsApp.

---

## 18. Decisões (ADRs) e Próximos Passos

**ADRs a criar:**
- `ADR-001 Multi-tenant: @TenantId + RLS vs schema` — shared column com RLS, evolui para schema só enterprise.
- `ADR-002 Criptografia: AES-GCM Converter + HMAC vs pgcrypto` — app-side vencedor, pgcrypto só `hmac()` se necessário.
- `ADR-003 Retenção 5a fiscal vs anonimização LGPD`.
- `ADR-004 Fiscal gateway: Nuvem Fiscal/Focus MVP → SefazDireto Fase 3`.
- `ADR-005 Frontend: React+Vite+Tailwind vs Angular` — React reaproveita OUTBOXERP.

**7 dias:**
1. Travar spec §4.2 `cpf→cpf_cipher/hash`, §4.3 `GrauOlho→od/oe_cipher`, §7 JWT/RLS/LogAuditoria
2. Workshop DPIA com DPO + ótico RT
3. S0: `V1__baseline + EntidadeBase + TenantContext` como primeiro PR isolado
4. Validar `theme-visionbox.css` dark/light com `axe` + PDV noturno

**30 dias:** S1–S2 ok, testes tenant+OS verdes, seed NCM 9003/9004 SP/RJ/MG, 20 NFC-e homolog `ambiente=2` com QR validado, `docker compose up` sobe PG/Redis/Rabbit/MinIO/app.

---

## 19. Checklists Executáveis

### Backend/DBA — fazer agora
- [ ] `EntidadeBase + TenantContext + TenantFilter + @TenantId` + `loja_id NOT NULL` + RLS
- [ ] `CpfConverter/GrauConverter AES-GCM + cpf_hash HMAC` + Vault pepper
- [ ] `SecurityConfig JWT` access 15m + refresh httpOnly rotation + Redis blacklist
- [ ] `Flyway V1–V11` + `docker-compose.dev.yml` + `V12 maquina` com `ADD COLUMN NULL + CREATE INDEX CONCURRENTLY`
- [ ] `TransicaoOSRegistry + EventoOS + Outbox + IdempotencyKey + ProblemDetail`
- [ ] `TributacaoService + FiscalProvider` + `tributacao_regra` seed
- [ ] `VerificaAtrasoOSJob` com `ShedLock`/`Quartz`

### Frontend — fazer agora
- [ ] `npm create vite react-ts` + Tailwind `darkMode selector` + `theme-visionbox.css` + shadcn adaptado + `data-theme` toggle
- [ ] `apiClient` axios + `openapi-typescript` + `ProblemDetail` handler
- [ ] Login + RBAC guard + Cliente/Receita (RHF+Zod+ViaCEP+S3 presigned)
- [ ] PDV teclado-first + `PdvCartStore` + Kanban semáforo `.status-*`
- [ ] Dexie outbox + Workbox SW + `SyncIndicator` + `Idempotency-Key`

### Security/LGPD
- [ ] `SEC-001..005` Fase 0 (tenant, cipher, JWT, hardening CVE-2026-2005, audit)
- [ ] Consentimento recall + `/lgpd/solicitacoes` + anonimização 5a + ROPA/DPIA v1 + DPO nomeado
- [ ] Logs mascarados + backup cifrado + DLP export

### QA
- [ ] `StatusOSTransicaoTest` parametrizado 12 estados
- [ ] `IsolamentoTenantTest` + `IdempotenciaPDVTest` + `OutboxRabbitTest`
- [ ] `ReceitaGrauValidatorTest` + `EstoqueNegativoTest` + `SLAJobTest Clock.fixed`
- [ ] `JaCoCo 80% + PIT 80% + Sonar` + `k6 pdv-duplo-clique.js`

### DevOps
- [ ] `Dockerfile` distroless + `docker-compose.dev.yml` → `docker compose up` sobe tudo
- [ ] `.env.example + Vault application-prod.yml` + `ci.yml` com `flyway validate→test→sonar→trivy→deploy`
- [ ] Micrometer + log JSON + OTel + Grafana dashboards + alertas `OSAtrasada/OutboxLag/FiscalContingencia`
- [ ] Backup `pgBackRest + WAL` + `restore-drill` mensal

---

**Referências:** `visionbox-especificacao.md:51-71` arquitetura, `visionbox-especificacao.md:86-102` EntidadeBase, `visionbox-especificacao.md:114-141` Cliente, `visionbox-especificacao.md:149-185` Receita, `visionbox-especificacao.md:194-230` Produto, `visionbox-especificacao.md:239-286` OS/Eventos, `theme-visionbox.css:6-47` tokens, `theme-visionbox.css:52-85` dark, `theme-visionbox.css:91-102` status, OWASP Top10 2025, ASVS 4.0, ISO 27001:2022, LGPD 13.709, CVE-2026-2005/CVE-2026-40973, CTN art.174.

> Próximo comando sugerido: `docker compose up` após criar `V1__baseline` + `EntidadeBase` — destrava todo o resto. Quer que eu gere os scaffolds (`V1.sql`, `EntidadeBase.java`, `tailwind.config.ts`, `docker-compose.dev.yml`) no mesmo diretório?
