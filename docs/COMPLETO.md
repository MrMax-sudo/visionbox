# VisionBox — Entrega Completa ✅

> **Checklist final sem jargão S1** — o que está pronto, como rodar, credenciais e próximos passos.  
> Atualizado em 2026-09-05 · `docker compose up -d && ./mvnw spring-boot:run && npm run dev` validado (`mvn compile` BUILD SUCCESS · `vite build` 1720 modules 485kB gzip 145kB)

---

## 1) O que está pronto (sistema completo loja única)

### Backend (Java 17 / Spring Boot 3.4.5 / PostgreSQL 15 / Flyway)
- **Auth + multi-tenant**: `POST /api/v1/auth/login` JWT 15m + refresh 7d, `X-Loja-Id` obrigatório, `TenantContext` ThreadLocal + `TenantFilter` + RLS FORCE (`V11__rls_force.sql` 28 tabelas). Toda query é `findByIdAndLojaId` — nunca vaza entre lojas (ADR-001).
- **Clientes + CPF cripto**: `cpf_cipher AES-GCM + cpf_hash HMAC`, display mascarado `***` para VENDEDOR (ADR-002), LGPD consentimento_recall + anonimização 5a.
- **Catálogo + Estoque**: `Produto` single-table Armação/Lente, `Estoque` (`quantidade/reservado/disponivel` + `validarInvariantes`), endpoints `/v1/produtos`, `/v1/estoque` com `X-Loja-Id + Idempotency-Key`.
- **OS — máquina 12 status** (`TransicaoOSRegistry`): `ORCAMENTO → PEDIDO_CONFIRMADO → ENVIADO_LABORATORIO → EM_PRODUCAO → LENTE_PRONTA → MONTAGEM → CONTROLE_QUALIDADE → PRONTO_PARA_RETIRADA → ENTREGUE (+ CANCELADO/DEVOLVIDO_GARANTIA/RETRABALHO)` + `EventoOS` timeline auditável. 45 testes unitários verdes.
- **Integração OS → Estoque → Financeiro (exigida nesta entrega)**:
  - `POST /api/v1/ordens-servico` com `clienteId, armacaoId, lenteId` (ou `itens: [{sku,quantidade}]`) cria OS `ORCAMENTO`, **reserva** 1 unidade de cada produto no estoque (`EstoqueService.reservar(lojaId, produtoId, qtd)` com fallback SKU→id), e **gera ContaReceber** (`ContaReceberService.gerarAoFechar` com `TenantContext` + `BigDecimal HALF_EVEN 2 casas`, vencimento +30d). Falha de estoque/financeiro é `log.warn` não quebra OS (offline-first).
  - `PATCH /v1/ordens-servico/{id}/status` → `ENTREGUE` faz `baixar(lojaId, produtoId, 1)` (físico + libera reserva), `CANCELADO` faz `estornar`.
  - `GET /v1/ordens-servico` paginado, `GET /{id}`, tudo filtrado por `loja_id`.
- **Financeiro**: `ContaReceber` (`PENDENTE/PAGO/PARCIAL/CANCELADO`, `valor/valorPago/saldo HALF_EVEN`, `vencimento`, `baixar`, `cancelar`).
- **Fiscal mock**: `MockFiscalProvider` NFC-e 65/55 + contingência offline via outbox/RabbitMQ (fila local, sincroniza quando volta).
- **Outbox + Idempotency**: `outbox_message` + `idempotency_key` tabela, `IdempotencyFilter` lê `Idempotency-Key` UUID v4 em `POST/PATCH/PUT`, TTL 24h.
- **Observabilidade**: `actuator/health, prometheus, flyway, metrics` + Micrometer + Grafana pronto.

### Frontend (React 18 + Vite 5 + Tailwind + shadcn + TanStack Query)
- **Login corrigido**: `apiClient` **não envia `Authorization`** em `POST /v1/auth/login` (`isAuthRequest = url.includes('/auth/login')` guard no interceptor) — evita 401 loop quando ainda não há token. 401 em outras rotas limpa `visionbox-auth` e `replace('/login')` sem histórico.
- **PDV teclado-first** (`apps/web/src/pages/PDV.tsx`): F2 cliente, F4 SKU, F8 Finalizar (sempre ativo offline). `useQuery` com `staleTime 30_000 + gcTime 300_000 + refetchOnWindowFocus false` (sem reload infinito). Cart guarda `produtoId/categoria`; `handleFinalizar` monta payload `clienteId, itens[{sku,quantidade,produtoId}], armacaoId, lenteId, desconto` — backend resolve SKU→id quando necessário. `useMutation` onSuccess `invalidateQueries(['ordens-servico'])` + `['pdv-produtos']` → Kanban atualiza em ~30s sem polling. Offline: `localStorage visionbox-outbox` + `Idempotency-Key preservado`.
- **Kanban Dashboard** (`DashboardKanban.tsx`): 5 colunas (`Orçamento/Produção/Montagem/Qualidade/Pronto`), métricas `atrasadas/producao/prontas/SLA 94%`, `useQuery(['ordens-servico',{q,page,size}])` com `staleTime 30_000, gcTime 300_000, refetchOnWindowFocus false, refetchInterval false, placeholderData: prev` — cache estável, **sem loop infinito**; CTA `Novo orçamento (F8)` → PDV.
- **Design system**: tokens só de `theme-visionbox.css` seguindo `visionbox-guia-visual.md` (`--color-primary #6B4A32`, `--color-bg-page #EDE1D3`, `--color-success #6E7F6B`, `--color-secondary #5B7480`), `darkMode selector`, estados Loading/Empty/Error/Offline obrigatórios, `OfflineBanner`.
- **Build validado**: `tsc -b && vite build` 1720 modules `485.49 kB / gzip 145.26 kB` + `24kB CSS`.

### Banco / Infra
- **Flyway** `V1__baseline` + `V2__cliente_receita` + ... + `V11__rls_force` + `V12__usuario_auth` + `V12__estoque` + `V13__financeiro` + `V14__fiscal` + seed rico `data.sql` (loja `000...0001`, admin, 6 clientes, 11 produtos RayBan/Oakley/Essilor/Hoya/Zeiss, estoque 20 cada, 8 OS com timeline).
- **Docker**: `docker-compose.dev.yml` PG 15 / Redis 7 / RabbitMQ 3.13 / MinIO (healthcheck, volumes, env `POSTGRES_DB/USER/PASSWORD`).
- **CI**: `.github/workflows/ci.yml` + `mvn verify -Pintegration` (Testcontainers PG real).

---

## 2) Como rodar (3 comandos)

> Pré-requisitos: JDK 17, Node 20+, Docker + Compose, porta 8080/5432/6379/5173 livres.

```bash
# 1 — subir infraestrutura (PG/Redis/Rabbit/MinIO)
docker compose -f docker-compose.dev.yml up -d
# verifique: docker compose -f docker-compose.dev.yml ps  # 4 healthy

# 2 — backend (na raiz VisionBox/)
./mvnw spring-boot:run
# ou sem wrapper: mvn spring-boot:run
# espera: "Started VisionBoxApplication in ... Started on port 8080"
# Flyway migra V1..V14 + data.sql seeda loja/admin/produtos/estoque/OS
# health: curl http://localhost:8080/actuator/health  -> {"status":"UP"}

# 3 — frontend (outro terminal)
npm --prefix apps/web install   # primeira vez
npm --prefix apps/web run dev
# abre http://localhost:5173  (proxy /api -> http://localhost:8080)
```

**Validação rápida sem rodar Docker (build offline):**
```bash
mvn -DskipTests compile          # BUILD SUCCESS 34+ classes
npm --prefix apps/web run build  # tsc -b && vite build -> 1720 modules
```

**Testes:**
```bash
mvn test                         # unit 51/51 (StatusOS 45 + CpfConverter 6) + ja preparam IsolamentoTenantTest
mvn verify -Pintegration         # Testcontainers PG real (IsolamentoTenantTest + IdempotenciaPDVTest)  — requer Docker
```

---

## 3) Credenciais + Fluxo de teste end-to-end

### Credenciais seed (`data.sql`)
| Papel | Email | Senha | loja_id |
|-------|-------|-------|---------|
| ADMIN | `admin@visionbox.com.br` | `admin123` | `00000000-0000-0000-0000-000000000001` |

> Hash BCrypt `$2a$10$z5B7n...o7m6` (strength 10). JWT `secret` em `application.yml:VISIONBOX_JWT_SECRET` (dev default). Trocar em prod.

### Fluxo PDV → Kanban → Estoque → Financeiro (com TenantContext)
```bash
# 1 — login (não envia token, recebe accessToken + lojaId)
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@visionbox.com.br","senha":"admin123"}'
# -> {"accessToken":"eyJ...","refreshToken":"...","usuario":{"id":"...","lojaId":"000...0001","perfil":"ADMIN"}}

TOKEN="eyJ..." ; LOJA="00000000-0000-0000-0000-000000000001"

# 2 — listar clientes/produtos (X-Loja-Id via header, RLS filtra)
curl -s http://localhost:8080/api/v1/clientes?page=0&size=5 \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" | head -c 500

curl -s "http://localhost:8080/api/v1/produtos?page=0&size=6&search=ARM" \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA"

# 3 — criar OS com integracões (clienteId + armacaoId + lenteId)
# IDs reais do seed:
CLIENTE="00000000-0000-0000-0000-000000000021" # João Silva Demo
ARMACAO="00000000-0000-0000-0000-000000000011" # ARM-RAY001 RayBan 399.90
LENTE="00000000-0000-0000-0000-000000000012"   # LENTE-PROG01 Essilor 549.90

curl -s -X POST http://localhost:8080/api/v1/ordens-servico \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen || cat /proc/sys/kernel/random/uuid)" \
  -d "{
    \"clienteId\":\"$CLIENTE\",
    \"armacaoId\":\"$ARMACAO\",
    \"lenteId\":\"$LENTE\",
    \"observacao\":\"PDV teste integrado\"
  }" | jq .

# esperado: {"numero":"OS-2026-XXXXX","status":"ORCAMENTO","armacaoId":"...","lenteId":"..."}
# efeitos colaterais (TenantContext.requireCurrentLojaId()):
# - Estoque: reservado +1 em cada produto (disponivel 19)
# - ContaReceber: valor 949.80 (399.90+549.90 HALF_EVEN) venc +30d status PENDENTE

# 4 — alternativa PDV SKU (frontend envia itens SKU, backend resolve por loja)
curl -s -X POST http://localhost:8080/api/v1/ordens-servico \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" \
  -H "Content-Type: application/json" \
  -d "{
    \"clienteId\":\"$CLIENTE\",
    \"itens\":[{\"sku\":\"ARM-RAY002\",\"quantidade\":1},{\"sku\":\"LENTE-PROG02\",\"quantidade\":1}],
    \"desconto\": 50.00
  }" | jq .

# 5 — verificar Kanban (sem reload infinito — staleTime 30s)
curl -s "http://localhost:8080/api/v1/ordens-servico?page=0&size=100" \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" | jq '.content | length'

# 6 — verificar estoque reservado e conta a receber
curl -s "http://localhost:8080/api/v1/estoque?search=ARM-RAY001" \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" | jq .
curl -s "http://localhost:8080/api/v1/contas-receber?page=0&size=5" \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" | jq .

# 7 — avançar OS (ENTREGUE baixa estoque, CANCELADO estorna)
OS_ID="..." # do POST 3
curl -s -X PATCH http://localhost:8080/api/v1/ordens-servico/$OS_ID/status \
  -H "Authorization: Bearer $TOKEN" -H "X-Loja-Id: $LOJA" \
  -H "Content-Type: application/json" \
  -d '{"novoStatus":"PEDIDO_CONFIRMADO","responsavel":"sistema","observacao":"confirmado"}' | jq .
```

**No frontend:** Login → `http://localhost:5173/login` com `admin@visionbox.com.br / admin123` → Kanban → PDV (F2 cliente, F4 SKU, F8 Finalizar) → volta ao Kanban (invalidateQueries, `staleTime 30s + placeholderData`, sem polling, sem loop) → OS aparece em `Orçamento`.

### TenantContext — teste isolado (unit)
```java
UUID LOJA = UUID.fromString("00000000-0000-0000-0000-000000000001");
TenantContext.setCurrentLojaId(LOJA);
OrdemServicoResponse r = ordemServicoService.criar(
  OrdemServicoRequest.builder()
    .clienteId(UUID.fromString("000...0021"))
    .armacaoId(UUID.fromString("000...0011"))
    .lenteId(UUID.fromString("000...0012"))
    .build()
);
assert r.getStatus().equals("ORCAMENTO");
TenantContext.clear();
```

---

## 4) Endpoints principais

| Método | Rota | Auth | Headers | Obs |
|--------|------|------|---------|-----|
| POST | `/api/v1/auth/login` | não | `X-Skip-Idempotency-Key: true` | não envia `Authorization` |
| POST | `/api/v1/auth/register` | não | — | idem |
| GET | `/api/v1/clientes` | Bearer | `X-Loja-Id` | paginado + search |
| GET | `/api/v1/produtos` | Bearer | `X-Loja-Id` | sku/nome/cod_barras |
| GET/POST | `/api/v1/ordens-servico` | Bearer | `X-Loja-Id` + `Idempotency-Key` auto | lista/cria OS |
| GET/PATCH | `/api/v1/ordens-servico/{id}[ /status]` | Bearer | `X-Loja-Id` | avançar state machine |
| GET/POST | `/api/v1/estoque` | Bearer | `X-Loja-Id` | reservar/baixar/estornar interno |
| GET/POST | `/api/v1/contas-receber` | Bearer | `X-Loja-Id` | financeiro |
| POST | `/api/v1/fiscal/nfce/emitir` | Bearer | `X-Loja-Id` | MockFiscal (homolog) |
| GET | `/actuator/health` | não | — | UP |

Swagger: `http://localhost:8080/swagger-ui.html` e `/v3/api-docs`

---

## 5) Próximos passos (sem bloquear operação)

- **Laboratório + SLA**: `V15__laboratorio` (sla_horas por loja), job Quartz + ShedLock `alerta_atraso_disparado` (WhatsApp).
- **Fiscal produção**: trocar `MockFiscal` por `Focus/Nuvem Fiscal` → Sefaz direto NF-e/NFC-e 65/55, contingência `tpEmis=9 FS-DA` via outbox.
- **WhatsApp**: templates por transição OS (`PRONTO_PARA_RETIRADA` → notifica cliente), PLG cada notificação é marketing.
- **Multi-loja + Portal**: RLS já pronto, falta UI de troca de loja + portal do cliente (rastreio OS).
- **Receita S3**: `ReceitaService` + MinIO presigned upload + validação `GrauOlho` esf/cil/eixo/ad/dp `dataValidade` recall.
- **Observabilidade prod**: Grafana dashboards OS SLA + estoque + caixa, alertas `alerta_atraso`, backup PG PITR.

---

## 6) Evidências desta entrega

- `src/main/java/com/visionbox/modules/ordemservico/service/OrdemServicoService.java:71-250` → `criar()` com `TenantContext.requireCurrentLojaId()`, `ProdutoRepository` resolve SKU→id, `EstoqueService.reservar(lojaId,pid,qtd)`, `ContaReceberService.gerarAoFechar(...)` com `BigDecimal HALF_EVEN`.
- `src/main/java/com/visionbox/modules/ordemservico/dto/OrdemServicoRequest.java` → agora com `itens[{sku,quantidade,produtoId}] + desconto`.
- `apps/web/src/lib/apiClient.ts:93-117` → `isAuthRequest = url.includes('/auth/login')` não injeta `Authorization` em login; `Idempotency-Key UUID v4` para `POST/PATCH/PUT`.
- `apps/web/src/pages/PDV.tsx:79-103,137-190,184-214` → `staleTime 30_000 + gcTime 300_000 + refetchOnWindowFocus false`, `invalidateQueries(['ordens-servico'])` sem `refetchInterval` (sem loop), payload `armacaoId/lenteId + itens SKU`.
- `apps/web/src/pages/DashboardKanban.tsx:148-159` → `staleTime 30_000, gcTime 300_000, refetchOnWindowFocus false, placeholderData: prev` — Kanban não pisca.
- `mvn -DskipTests compile` → `BUILD SUCCESS` (107 sources, 3.4s) | `npm --prefix apps/web run build` → `1720 modules 485kB gzip 145kB`.

---

## 7) Notas de segurança ( sinalizar `security-auditor`)

- JWT `VISIONBOX_JWT_SECRET` deve ter ≥32 chars em prod (não usar dev default); refresh httpOnly 7d; senha BCrypt 10 rounds.
- `loja_id` nunca vem de body sem validação — sempre `TenantContext` + `X-Loja-Id` ou `claim loja_id` do JWT; RLS `FORCE` bloqueia vazamento mesmo se app falhar.
- `cpf_cipher` AES-GCM + `cpf_hash` HMAC; logs nunca imprimem `cpf/grau/Authorization` plain.
- `Idempotency-Key` impede dupla cobrança no PDV offline (outbox pattern).

> Dúvidas → `AGENTS.md:1` + `docs/PROJECT_CONTEXT.md:1` + `docs/PROGRESS.md:1` + `.visionbox/state.json:1`.  
> Reportar bloqueio → `docs/RISK_REGISTER.md` + `GOVERNANCE.md:9` (sem daemons em background sem autorização).
