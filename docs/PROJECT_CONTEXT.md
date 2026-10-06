# VisionBox — Contexto do Projeto

> **Single source of truth** para qualquer agente/humano entrar no projeto e ter contexto completo em 10 minutos.
> **Fontes canônicas:** `visionbox-especificacao.md` + `theme-visionbox.css` + `arquivo.md` (plano executivo)
> **Atualizado em:** 2026-09-05

---

## 1. Identidade

| Campo | Valor |
|---|---|
| **Produto** | `VisionBox` — família TECHBOXBR (Outbox, Pointbox, Finbox, Cashbox) |
| **Domínio** | ERP vertical para óticas (loja única ou rede) |
| **Proposta** | Unificar Comercial + Produção/OS + Financeiro/Relacionamento com rastreabilidade real de OS |
| **Diferencial central** | Máquina 12 status OS + timeline + notificação WhatsApp + SLA laboratório (`visionbox-especificacao.md:265-274`) |
| **Nome técnico** | `com.visionbox` |
| **Repositório** | `D:\TECHBOXBR\PRODUTOS\VisionBox` |

## 2. Problema e Tese

Ótica = varejo + saúde + manufatura sob encomenda (`visionbox-especificacao.md:10`). Sistemas de mercado resolvem PDV razoavelmente e financeiro, mas OS fica como texto livre sem timeline (`visionbox-especificacao.md:16`). Consequência: ligações "onde está meu óculos?", retrabalho por lente errada, estoque fantasma, caixa não fecha.

**Tese de vitória:** ganhar em `OS sem atrito + Financeiro que fecha + Cliente rastreia no WhatsApp` — não em PDV mais barato. Cada notificação é marketing (PLG).

**Concorrentes:** Óticas World, Sistema Ótica Fácil, SóOtica, GestãoClick adaptado, Bling+planilhas (`visionbox-especificacao.md:303-316`).

## 3. Fluxos que Caminham Juntos

1. **Comercial:** escolhe armação, traz receita/exame, fecha pedido (`visionbox-especificacao.md:11`)
2. **Produção/OS:** receita → lente técnica → laboratório interno/terceirizado → montagem → CQ → entrega (`visionbox-especificacao.md:12`)
3. **Financeiro/Relacionamento:** parcelamento, convênios, garantia, recall receita vencida, pós-venda (`visionbox-especificacao.md:13`)

## 4. Stack Congelada

| Camada | Tecnologia | Obs |
|---|---|---|
| Linguagem | Java 17 LTS | `visionbox-especificacao.md:22` |
| Framework | Spring Boot 3.x | — |
| Persistência | Spring Data JPA + Hibernate 6 | — |
| Banco | PostgreSQL 15+ multi-schema multi-loja | `loja_id` shared, evolução schema por tenant |
| Boilerplate | Lombok | — |
| Migração | Flyway | V1..V11 + V12+ incrementais |
| DTO | MapStruct | — |
| Validação | Jakarta Validation | — |
| Segurança | Spring Security + JWT access 15m / refresh 7d httpOnly | — |
| Docs API | springdoc-openapi | — |
| Mensageria | Spring Events sync + RabbitMQ async + outbox pattern | OUTBOXERP reaproveitado |
| Cache/Rate | Redis | — |
| Jobs | Spring Scheduler + Quartz + ShedLock | recall, SLA |
| Arquivos | S3/MinIO | receita digitalizada, armação 3D |
| Frontend | React 18 + Vite + Tailwind (padrão OUTBOXERP) | `theme-visionbox.css` tokens |
| Fiscal | Focus/Nuvem Fiscal MVP → SefazDireto Fase 3 | NFC-e 65 / NF-e 55 4.00 |
| Testes | JUnit5 + Testcontainers (PG real) + Mockito + PIT | — |
| Observabilidade | Micrometer + Prometheus + Grafana + Logback JSON | — |
| Containers | Docker + Compose dev / K8s ou Swarm prod | — |

## 5. Arquitetura

Hexagonal-light (`visionbox-especificacao.md:47-71`):

```
com.visionbox/{config, shared, modules/{pessoa,clinico,catalogo,estoque,compras,vendas,ordemservico,laboratorio,financeiro,convenio,fiscal,crm,agenda,usuario,relatorios}, api}
```

Cada módulo: `domain → repository → service → mapper → dto → controller → event`. Multi-tenant `shared database, discriminator column loja_id` (`visionbox-especificacao.md:75`), com RLS como segunda barreira.

## 6. Domínio Essencial

- **EntidadeBase:** UUID `gen_random_uuid()`, `loja_id`, `criadoEm/atualizadoEm timestamptz`, `@Version`, `ativo` soft-delete (`visionbox-especificacao.md:84-102`)
- **Cliente:** nome, `cpf_cipher + cpf_hash HMAC`, `Contato/Endereco` @Embeddable, `canalPreferido`, `scoreRecompra` (`visionbox-especificacao.md:107-141`)
- **Receita:** `GrauOlho(od/oe)` embeddable `esferico/cilindrico/eixo/adicao` + `dp`, `dataValidade` usada para recall, `anexo S3 key` (`visionbox-especificacao.md:148-185`)
- **Produto single-table:** `Armacao(material,formato,corAro,modelo3dUrl)` + `Lente(tipo,material,antirreflexo,fotossensivel)` (`visionbox-especificacao.md:191-230`)
- **OrdemServico:** núcleo diferencial `numero OS-2026-00123`, `status` 12 estados, `historico EventoOS`, `previsaoEntrega/alertaAtraso` (`visionbox-especificacao.md:234-286`)
- **Máquina OS:** `ORCAMENTO → PEDIDO_CONFIRMADO → ENVIADO_LABORATORIO → EM_PRODUCAO → LENTE_PRONTA → MONTAGEM → CONTROLE_QUALIDADE → PRONTO_PARA_RETIRADA → ENTREGUE (+ CANCELADO/DEVOLVIDO_GARANTIA/RETRABALHO)` + `EventoOS(statusAnterior/novo, dataHora, responsavel)` (`visionbox-especificacao.md:268-274`)
- **Fiscal:** NFC-e/NF-e 65/55 + contingência offline reaproveitando outbox (`visionbox-especificacao.md:328-329`)

## 7. Design System

`theme-visionbox.css:6-47` tokens seguem `visionbox-guia-visual.md`: `--color-primary #6B4A32` (marrom café), `--color-primary-dark #3E2C22`, `--color-secondary #5B7480` (azul-acinzentado), `--color-success #6E7F6B` (verde oliva), `--color-bg-page #EDE1D3`, `--color-bg-panel #D9C4A3`, `--color-text-primary #3E2C22`, variantes `dark`/`light`, classes `.status-*` mapeando OS para cores AA 4.5:1 (`theme-visionbox.css:91-102` e `visionbox-especificacao.md:360-376`).

## 8. Restrições e Reaproveitamento

- Reaproveitar SO OUTBOXERP: outbox+RabbitMQ fila local, contingência fiscal, multi-tenant (`visionbox-especificacao.md:382-387`)
- Modo offline PDV obrigatório Fase 1 (venda não pode travar sem internet)
- LGPD nativo: receita = dado saúde sensível art.11, criptografia repouso + audit trail (`visionbox-especificacao.md:332-341`)
- Nenhuma alíquota hard-coded; sempre `tributacao_regra(NCM+UF+CRT)`

## 9. Glossário Ótico

| Termo | Significado |
|---|---|
| **ESF/CIL/EIXO/AD/DP/DNP** | Grau esférico/cilíndrico/eixo/adição/distância pupilar/naso-pupilar |
| **CSOSN/CST/CFOP/NCM/CEST** | Códigos tributários |
| **SVC-AN/SVC-RS, tpEmis=9 FS-DA** | Contingências SEFAZ |
| **Surfaçagem** | Fabricação da lente a partir do bloco (só 15% óticas) |
| **Laboratório** | Interno ou terceirizado que produz lente |

## 10. Onde Está Cada Coisa Neste Repo

| Arquivo | Papel |
|---|---|
| `visionbox-especificacao.md` | Spec canônica (congelada) |
| `theme-visionbox.css` | Tokens oficiais (não duplicar) |
| `arquivo.md` | Plano executivo consolidado (8 especialistas) |
| `docs/PROJECT_CONTEXT.md` | Este arquivo |
| `docs/GOVERNANCE.md` | Processo, papéis, DoR/DoD, cerimônias |
| `docs/ROADMAP.md` | Roadmap visual por fase/sprint |
| `docs/BACKLOG.md` | Épicos + user stories + critérios aceite |
| `docs/PROGRESS.md` | Estado atual, burndown, evidências |
| `docs/RISK_REGISTER.md` | Riscos + mitigações |
| `docs/METRICS.md` | Métricas NSM + KPIs + dashboards |
| `docs/adrs/` | ADRs 001–005 |
| `docs/sprints/` | S0..S6 detalhados |
| `docs/runbooks/` | Operação fiscal/backup/incidente |
| `.visionbox/state.json` | Estado máquina-legível para agentes |
| `.visionbox/context.json` | Contexto injetável em prompts de agente |

> **Regra para agentes:** antes de codar, leia `docs/PROJECT_CONTEXT.md` + `docs/PROGRESS.md` + ADR relevante. Nunca re-derive stack.
