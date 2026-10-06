# VisionBox — Sistema de Gestão para Óticas

> Família TECHBOXBR (Outbox, Pointbox, Finbox, Cashbox). ERP vertical: Comercial + OS (laboratório) + Financeiro/Relacionamento com rastreio WhatsApp + SLA lab.

## Início Rápido (para humanos e agentes)

1. **Leia contexto:** `docs/PROJECT_CONTEXT.md` (10 min) + `docs/PROGRESS.md` + `.visionbox/state.json`
2. **Veja roadmap:** `docs/ROADMAP.md` — Fase 1 MVP S0–S6 (16 sem), S0 é Foundation
3. **Pegue uma US:** `docs/BACKLOG.md` — S0 tasks `todo` → mova para `doing` e atualize `PROGRESS.md` + `state.json`
4. **Decisões:** `docs/adrs/` — ADRs 001–005 já aceitos (tenant, cifra, retenção, fiscal, frontend)
5. **Processo:** `docs/GOVERNANCE.md` — DoR/DoD, cerimônias, RACI
6. **Riscos/métricas:** `docs/RISK_REGISTER.md`, `docs/METRICS.md`

## Estrutura

```
VisionBox/
├── visionbox-especificacao.md  # spec canônica (congelada)
├── theme-visionbox.css         # tokens oficiais (não duplicar hex)
├── arquivo.md                  # plano executivo 8 especialistas
├── README.md                   # este arquivo
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── GOVERNANCE.md
│   ├── ROADMAP.md
│   ├── BACKLOG.md
│   ├── PROGRESS.md             # snapshot humano — atualize todo daily
│   ├── RISK_REGISTER.md
│   ├── METRICS.md
│   ├── adrs/ADR-00{1..5}.md
│   ├── sprints/S0..S6.md
│   └── runbooks/{backup-restore,fiscal-contingencia,incidente}.md
└── .visionbox/
    ├── state.json              # estado máquina-legível (fonte para agentes)
    └── context.json            # prompt injetável
```

## Como Manter Progresso

- **Todo daily:** atualize `docs/PROGRESS.md` (burndown + quadro) + `.visionbox/state.json` (`current_sprint`, `progress_pct`, `milestones[]`, `next_actions`)
- **Todo PR:** referencie `USxx` (ex: `feat(US04): PDV`) e marque `BACKLOG.md` Status `done` + PR link
- **Todo sprint review:** adicione linha em `PROGRESS.md#Histórico` + screenshot/demo link
- **Toda decisão:** novo `docs/adrs/ADR-00N-*.md` + atualize `context.json`

## Próximos 3 Passos (S0)

- [ ] PR `V1__baseline + EntidadeBase + TenantContext + RLS` (desbloqueia tudo)
- [ ] `docker compose up` (PG15+Redis+Rabbit+MinIO) + `flyway validate`
- [ ] Figma Orçamento→Kanban validado com 3 óticas

> **Regra de ouro:** nenhum `findById` sem `lojaId`, nenhum CPF/Grau plain, nenhuma alíquota hard-coded.

# visionbox
