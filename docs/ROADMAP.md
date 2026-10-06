# VisionBox — Roadmap Visual

> Fonte: `visionbox-especificacao.md:345-357` + `arquivo.md` §4. Timeline em sprints de 2 semanas, squad 1 PO + 2 devs + 1 QA.

## Linha do Tempo

```
S0  S1  S2  S3  S4  S5  S6  | S7  S8  S9  S10 | S11 S12 S13 S14 | S15 S16+
W1-2 3-4 5-6 7-9 10-11 12-15 16          17-20         21-26         27+
├─ FASE 1 MVP loja única ─┤├─ FASE 2 Diferenciação ─┤├─ FASE 3 Escala ─┤├─ FASE 4 Expansão
```

## Fase 1 — MVP Loja Única (S0–S6, 16 semanas)

| Sprint | Sem | Backend paralelo | Frontend paralelo | Entregável validado | Gate |
|---|---|---|---|---|---|
| **S0 Setup** | 1-2 | Repo, Security JWT, Flyway V1, TenantContext, EntidadeBase | Vite+Tailwind+`theme-visionbox.css`, shadcn, apiClient ProblemDetail, Storybook | Builda, dark toggle ok, `generate:api` ok | CI verde |
| **S1** | 3-4 | `pessoa` Cliente CPF cipher/hash, `usuario` RBAC | Login, Cadastro Cliente+ViaCEP+LGPD, lista clientes, guard RBAC | Cadastro cliente <5min com 3 óticas | Demo S1 |
| **S2** | 5-6 | `clinico` Receita+Grau+ S3 presigned, `catalogo` Produto single-table | Form Receita+upload 5MB, Catálogo grid+filtros | Receita coerente validada | Upload S3 |
| **S3** | 7-9 | `vendas` Orcamento→Pedido, `ordemservico` StateMachine 12 status | PDV F2/F4/F8 teclado-first, carrinho Zustand, OS criação | PDV <100ms, foco automático | `mão na massa` 20 OS |
| **S4** | 10-11 | `EventoOS`+SpringEvent→Outbox→Rabbit | Dashboard Kanban + Timeline + SLA badge semáforo | 100% `.status-*` + polling 30s | Kanban demo |
| **S5** | 12-13 | `financeiro` simples, `fiscal` mock NFC-e 65 | Financeiro Receber/Pagar, caixa, fiscal badge contingência | Fiscal mock autoriza | — |
| **S6** | 14-15 | `outbox`+Rabbit real, `estoque` reserva | Dexie outbox+SW Workbox+SyncIndicator+Fila+conflict | PDV offline 100% airplane mode | E2E Playwright |
| **RELEASE F1** | 16 | Homologado | Lighthouse 90+, axe 0 | Tag `v1.0-mvp` 10 lojas beta | Go/No-Go |

## Fase 2 — Diferenciação (S7–S10)

| Sprint | Foco | Entregável |
|---|---|---|
| S7-8 | Laboratório + Recall | Portal lab token, fila produção+CQ, job recall `dataValidade BETWEEN now+30d` com `consentimento_recall` |
| S9-10 | SLA + Notificação | `VerificaAtrasoOSJob` + Rabbit `os.pronto_para_retirada`, dashboard lab lead time Grafana |

## Fase 3 — Escala (S11–S14)

| Sprint | Foco | Entregável |
|---|---|---|
| S11-12 | Multi-loja + Portal | Switcher loja, transferência estoque 5152, portal PWA `portal.visionbox.com.br` magic link CPF+OTP |
| S13-14 | Assinatura + WebAR | Assinatura lente contato gateway tokenizado, prova virtual `MediaPipe+Three.js` lazy (`modelo3dUrl`) |

## Fase 4 — Expansão (S15+)

App nativo, marketplace laboratórios, IA recomendação armação por formato rosto. Fiscal migrado para `SefazDireto`.

## Marcos (Milestones)

| Marco | Data alvo | Critério | Evidência |
|---|---|---|---|
| M0 Kickoff | W1 | `PROJECT_CONTEXT` + ADRs 001-005 assinados | `docs/adrs/` |
| M1 S0 Done | W2 | `V1__baseline` + `TenantContext` PR merge | `flyway validate` log |
| M2 MVP Piloto | W9 | 2 óticas reais operando PDV+Kanban | Vídeo demo |
| M3 MVP Beta | W16 | 10 lojas beta, NSM >150 OS/loja/mês | `METRICS.md` |
| M4 Fase 2 | W20 | Lab integrado + recall + SLA dashboard | Grafana screenshot |
| M5 Fase 3 | W26 | Multi-loja + portal + WebAR Chrome | Portal URL |

## Dependências Críticas

- S3 presigned bloqueia S2 se atrasar → mockar com MSW.
- Sefaz Nuvem Fiscal `ambiente=2` bloqueia S5 → ter `FiscalProvider` mock.
- Outbox/Rabbit bloqueia S6 → feature flag `offline_queue` local.

## Visual Gantt (para colar no Miro/Notion)

```
F1 [████████████████████] 
F2         [████████████]
F3               [████████████]
F4                     [████████]
M0  M1    M2      M3    M4    M5
```

