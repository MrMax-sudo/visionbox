# AGENTS.md — VisionBox

> **Para humanos e IAs.** Este arquivo é a porta de entrada para qualquer agente (Muse, Cursor, Copilot, Codex, humano) trabalhar no VisionBox sem perder contexto.

## 1) Leia antes de fazer qualquer coisa

```
1. docs/PROJECT_CONTEXT.md   — contexto 10 min (identidade, tese, stack, domínio)
2. docs/PROGRESS.md          — onde estamos (fase, sprint, burndown)
3. .visionbox/state.json     — estado máquina-legível (fonte para automação)
4. arquivo.md                — plano executivo 8 especialistas (detalhe técnico)
5. ADR relevante em docs/adrs/  — decisão já tomada (não re-derive)
```

> **Regra:** nunca comece a codar sem ler `PROJECT_CONTEXT.md:1` + `PROGRESS.md:1` + `state.json:1`. Stack já está congelada (`docs/PROJECT_CONTEXT.md:34`).

## 2) O que é o VisionBox

ERP vertical para óticas (`visionbox-especificacao.md:4`) — família TECHBOXBR. Diferencial: máquina 12 status OS com timeline + WhatsApp + SLA lab (`visionbox-especificacao.md:265-274`), não PDV genérico. Fonte canônica é `visionbox-especificacao.md:1`, tokens em `theme-visionbox.css:6`.

## 3) Stack (não mudar sem ADR)

Java 17 + Spring Boot 3.x + JPA/Hibernate 6 + PostgreSQL 15 + Flyway + MapStruct + Spring Security JWT (15m/7d httpOnly) + RabbitMQ/outbox + Redis + Quartz + S3/MinIO + React+Vite+Tailwind. Detalhe em `docs/PROJECT_CONTEXT.md:34`.

## 4) Estrutura do repo

```
VisionBox/
├── visionbox-especificacao.md  # spec congelada
├── theme-visionbox.css         # tokens (não duplicar hex)
├── arquivo.md                  # plano 8 especialistas
├── AGENTS.md                   # este arquivo
├── README.md
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── GOVERNANCE.md           # DoR/DoD, cerimônias, RACI
│   ├── ROADMAP.md              # S0-S6 → Fase 4
│   ├── BACKLOG.md              # 17 US MoSCoW
│   ├── PROGRESS.md             # snapshot — atualize todo daily
│   ├── RISK_REGISTER.md
│   ├── METRICS.md
│   ├── adrs/ADR-00{1..5}.md
│   ├── sprints/S0..S6.md
│   └── runbooks/
└── .visionbox/
    ├── state.json              # atualize a cada movimento
    └── context.json            # prompt injetável
```

## 5) Como trabalhar (workflow)

### 5.1 Pegar uma tarefa

1. Abra `docs/BACKLOG.md:1` → escolha US com `Status: todo` no sprint atual (`state.json:current_sprint`).
2. Verifique `DoR` em `docs/GOVERNANCE.md:4` — se não cumprir, refine antes.
3. Mova US para `doing` em `BACKLOG.md` + `.visionbox/state.json:backlog` e crie branch `feature/US04-pdv`.

### 5.2 Implementar

- **Backend:** `com.visionbox/modules/{dominio}/domain→repository→service→mapper→dto→controller→event` (`docs/PROJECT_CONTEXT.md:60`). Nunca `findById` sem `lojaId` (`AGENTS.md` regra crítica).
- **Frontend:** tokens só de `theme-visionbox.css:6`, `darkMode: selector [data-theme="dark"]`, estados Loading/Empty/Error/Offline obrigatórios.
- **DB:** Flyway `V{next}__descricao.sql`, `loja_id` em toda tabela, `timestamptz`, `numeric(12,2)`.
- **Fiscal:** nunca hard-code alíquota → `tributacao_regra(NCM+UF+CRT)`.
- **Segurança:** nunca plain CPF/Grau → `cpf_cipher + cpf_hash HMAC` AES-GCM (`docs/adrs/ADR-002-criptografia.md:1`).

### 5.3 Entregar

1. `mvn verify` + `flyway validate` verdes; cobertura ≥80% (≥95% OS/fiscal), `axe` 0, `docker compose up` sobe PG/Redis/Rabbit/MinIO.
2. PR com `feat(USxx): ...` + link evidência (log/screenshot) + atualize `docs/PROGRESS.md:1` (burndown/quadro/histórico) e `.visionbox/state.json:1` (`progress_pct`, `sprints[].progress`, `milestones[]`).
3. Só fecha US se `DoD` em `docs/GOVERNANCE.md:5` tickado.

## 6) Regras críticas (violar = bloquear deploy)

| # | Regra | Fonte |
|---|---|---|
| R1 | `loja_id` NOT NULL + `@TenantId`/`TenantFilter` + RLS — todo repo `findByIdAndLojaId` | `ADR-001` |
| R2 | CPF/Grau criptografado `AES-GCM + HMAC`, display mascarado `***` para VENDEDOR | `ADR-002` |
| R3 | Nenhuma alíquota hard-coded | `PROJECT_CONTEXT.md:87` |
| R4 | PDV `Idempotency-Key` + `outbox` — botão Finalizar sempre ativo offline | `arquivo.md` §13 |
| R5 | Nenhum hex fora de `theme-visionbox.css` | `theme-visionbox.css:6` |
| R6 | Toda transição OS validada em `TransicaoOSRegistry`, gera `EventoOS` | `visionbox-especificacao.md:268` |
| R7 | LGPD: `consentimento_recall` + anonimização 5a fiscal, não DELETE com NF | `ADR-003` |
| R8 | SEMPRE registrar o progresso em `docs/PROGRESS.md` e `.visionbox/state.json` antes de iniciar novas tarefas | `GOVERNANCE.md` |
| R9 | Módulo Fiscal integra com a API centralizada Flowbox (`D:\TECHBOXBR\PRODUTOS\Flowbox`) | `ADR-004` / `PROJECT_CONTEXT.md` |

## 7) Agentes disponíveis

| Agente | Quando acionar | Onde |
|---|---|---|
| `product-manager` | roadmap, MoSCoW, validação ótica | `docs/ROADMAP.md`, `BACKLOG.md` |
| `backend-engineer` | domínio OS, StateMachine, multi-tenant | `docs/adrs/ADR-001.md` |
| `db-admin` | DDL, índices, RLS, backup | `docs/adrs/ADR-001.md`, `runbooks/backup-restore.md` |
| `frontend-engineer` | React/Tailwind, PDV teclado-first, PWA | `docs/adrs/ADR-005.md` |
| `fiscal-engineer` | NFC-e 65/55, NCM/CFOP, contingência Flowbox | `docs/adrs/ADR-004.md`, `runbooks/fiscal-contingencia.md` |
| `security-auditor` | JWT, RBAC, cifra, LGPD | `docs/adrs/ADR-002.md`, `ADR-003.md` |
| `qa-engineer` | Testcontainers, PIT, k6 | `docs/GOVERNANCE.md:5` |
| `devops-infra` | Docker, CI/CD, Grafana | `runbooks/backup-restore.md` |

No `Task` tool use `subagent_type` correspondente e anexe `docs/PROJECT_CONTEXT.md` + trecho do ADR.

## 8) Comandos úteis

```bash
# dev completo
docker compose -f docker-compose.dev.yml up -d
mvn flyway:validate
mvn verify -Pintegration   # Testcontainers PG real
mvn pitest:mutationCoverage
npm --prefix apps/web run dev
npx axe apps/web/dist

# fiscal homolog (ambiente 2)
curl -H "X-Loja-Id: $LOJA" http://localhost:8080/api/v1/fiscal/nfce/emitir -d @payload.json

# atualizar progresso (manual)
# 1. edite docs/PROGRESS.md 2. edite .visionbox/state.json 3. commit
```

## 9) O que NUNCA fazer

- Editar `visionbox-especificacao.md` sem PR `BREAKING CHANGE` + ADR.
- Criar tabela sem `loja_id` ou sem `flyway` migration.
- Logar `cpf`, `grau`, `authorization` em plain.
- Duplicar cor hex no JSX — use `var(--color-*)`.
- Marcar US `done` sem evidência em `PROGRESS.md`.
- **NUNCA realizar exclusão de arquivos, classes ou diretórios sem ordem explícita do usuário.**
- **NUNCA iniciar novas implementações sem registrar o estado e progresso em `docs/PROGRESS.md` e `.visionbox/state.json`.**
- **NUNCA criar integrações fiscais proprietárias avulsas — o Módulo Fiscal DEVE integrar com o Flowbox.**
- **PROIBIDO subir qualquer processo em segundo plano sem autorização e ocupar portas desnecessárias** — nunca `Start-Process`, `nohup`, `docker run -d`, `mvn spring-boot:run` em background, `npm run dev` destacável sem ordem explícita; toda execução em primeiro plano com logs visíveis; liberar `8080/5432/5173` ao final (`GOVERNANCE.md:9`).

## 10) Onde tirar dúvidas

- Contexto → `docs/PROJECT_CONTEXT.md:1`
- Onde estamos → `docs/PROGRESS.md:1` + `.visionbox/state.json:1`
- Próximo sprint → `docs/sprints/S0.md`..`S6.md`
- Riscos → `docs/RISK_REGISTER.md:1`
- Métricas → `docs/METRICS.md:1`

> **Atualize este AGENTS.md quando criar novo ADR ou mudar cerimônia.** Última atualização: 2026-10-06.

