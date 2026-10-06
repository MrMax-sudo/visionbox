# VisionBox — Governança e Processo

## 1. Papéis

| Papel | Responsável | RACI |
|---|---|---|
| **PO / Product Manager** | Define roadmap, prioriza backlog MoSCoW, valida protótipo com 3 óticas | A |
| **Tech Lead / Backend** | Arquitetura hexagonal, Domínio OS, multi-tenant, fiscal gateway | R |
| **DBA** | DDL Flyway, índices, RLS, backup/PITR, tuning | R |
| **Frontend/UX** | Design system, PDV teclado-first, PWA offline | R |
| **Fiscal Engineer** | NCM/CFOP/CEST, NFC-e 4.00, contingência | R |
| **Security/LGPD** | Criptografia, RBAC, audit, DPIA | R |
| **QA** | Pirâmide testes, Testcontainers, k6 | R |
| **DevOps** | Docker, CI/CD, observabilidade, DR | R |

Squad Fase 1: 1 PO + 2 devs fullstack + 1 QA + 1 UX part-time, sprints 2 semanas.

## 2. Princípios

1. **Trunk-based + short-lived branches** (`feature/*`, `fix/*`), `main` sempre deployável, PR exige 1 review + CI verde + `flyway validate` + `no secrets`.
2. **Conventional commits** + `commitlint`.
3. **Nunca hard-code tributação** — sempre `tributacao_regra`.
4. **Nunca `findById` sem `lojaId`** — vazamento tenant bloqueia deploy.
5. **Nunca plain CPF/Grau** — cipher protege desde V2.
6. **Offline-first** — PDV botão Finalizar sempre ativo.

## 3. Cerimônias

| Cerimônia | Quando | Duração | Artefato |
|---|---|---|---|
| Sprint Planning | Segunda S0 | 2h | Sprint goal + tasks no `BACKLOG.md` |
| Daily | 09:00 | 15m | Atualiza `PROGRESS.md` + `state.json` |
| Review | Sexta final sprint | 1h | Demo com ótica piloto (gravar) |
| Retro | Após review | 45m | Ações em `PROGRESS.md#retros` |
| Refinement | Quarta | 1h | Quebra US em tasks S/M/L |
| DPIA Review | S0 + a cada fase | 1h | `RISK_REGISTER.md` |

## 4. Definition of Ready (DoR) — US só entra na sprint se:

- [ ] Tem persona + `Como/Quero/Para` + critérios de aceite testáveis
- [ ] Tem `complexidade S/M/L` + dependências mapeadas
- [ ] Tem contrato API (OpenAPI snippet) + validação Zod/Bean
- [ ] Tem caso de borda ótico listado + dado LGPD classificado
- [ ] Protótipo validado se for tela (Figma link)

## 5. Definition of Done (DoD) — US só fecha se:

- [ ] `mvn verify` + `flyway validate` verdes
- [ ] Cobertura ≥80% (≥95% OS/fiscal) + PIT ≥80%
- [ ] Teste tenant leak passa + teste idempotência se for PDV
- [ ] `ProblemDetail` tratado + `X-Total-Count` paginado
- [ ] `axe` 0 violações + contraste AA + estados Loading/Empty/Error/Offline
- [ ] Nenhum hex fora de token + nenhum secret no bundle
- [ ] `PROGRESS.md` + `state.json` atualizados + evidência (print/log) linkada
- [ ] Documentado em `BACKLOG.md` status `Done` + PR linkado

## 6. Fluxo de Trabalho do Backlog

```
Ideia → Épico → US (MoSCoW) → Refinada (DoR) → Sprint Backlog → In Progress → Code Review → QA (Testcontainers) → Done → Demo piloto
```

Status permitidos em `state.json`: `backlog, refinada, todo, doing, review, qa, done, blocked`.

## 7. Gestão de Mudança

- Mudança de spec §4/§7 exige ADR novo + atualização `visionbox-especificacao.md` via PR com `BREAKING CHANGE`.
- Escopo só muda com aprovação PO + impacto em `RISK_REGISTER.md`.
- Fiscal NT SEFAZ é exceção: entra como hotfix com `tributacao_regra` seed.

## 8. Comunicação

- Fonte de verdade: este `docs/` + `PROGRESS.md` (não WhatsApp).
- Decisões só valem se registradas em `docs/adrs/ADR-*.md`.
- Incidentes seguem `docs/runbooks/incidente.md` (detectar <72h LGPD).

## 9. Regra Crítica — Processos e Portas

> **PROIBIDO subir qualquer processo em segundo plano sem autorização, e ocupar portas desnecessárias.**
>
> - Agentes NUNCA executam `Start-Process`, `nohup`, `docker run -d`, `mvn spring-boot:run` em background, `npm run dev` destacável ou qualquer daemon sem ordem explícita do usuário.
> - Toda execução deve ser em primeiro plano, curta e com logs visíveis, ou via `docker compose up -d` apenas quando o usuário pedir e com `down` ao final.
> - Portas `8080` (API), `5432` (PG), `5173` (Vite) só ocupadas durante teste ativo autorizado; liberar imediatamente após validação.
> - Violar = bloquear deploy e registrar em `RISK_REGISTER.md` como incidente operacional.

> Registrado em 2026-09-05 por determinação do usuário.

