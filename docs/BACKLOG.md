# VisionBox — Backlog Priorizado

> `MoSCoW` + complexidade `S <1 sprint, M 1-2, L 2-3` (time 3 devs). Cada US tem critério de aceite testável.

## Épicos e User Stories

### F1-E1 Cadastro Base & Receita

| ID | US | MoSCoW | Compl | Aceite | Status |
|---|---|---|---|---|---|
| US01 | Como vendedor quero cadastrar cliente + receita (foto ESF/CIL/EIXO OD/OE) para iniciar orçamento | MUST | M | Campos -20..+20, cil 0..-6, eixo 0-180 obrigatório se cil≠0, foto obrigatória, S3 presigned | `todo` |
| US02 | Como vendedor quero cadastrar armação/lente com SKU/barras, marca, custo, preço | MUST | M | Busca <500ms com 5k SKUs, `UNIQUE(loja_id,sku)`, NCM String validada | `todo` |
| US03 | Como gestor quero importar clientes/produtos CSV | SHOULD | S | Template + erro linha-a-linha, `cpf_hash` dedup | `todo` |

### F1-E2 Orçamento → Venda (PDV Ótico)

| ID | US | MoSCoW | Compl | Aceite | Status |
|---|---|---|---|---|---|
| US04 | Criar orçamento armação+lente+serviço, aplicar desconto com alçada e transformar em OS 1 clique | MUST | L | Desconto >15% senha gerente, ao converter OS nasce `ORCAMENTO`, carrinho <16ms, `BigDecimal HALF_EVEN` | `todo` |
| US05 | Receber PIX/cartão/crediário Nx parcelas com baixa financeiro | MUST | M | Parcelas geram N títulos `conta_receber` vinculados à OS, `tPag=17` PIX | `todo` |

### F1-E3 Máquina OS 12 Status (Core)

Estados: `ORCAMENTO→PEDIDO_CONFIRMADO→ENVIADO_LABORATORIO→EM_PRODUCAO→LENTE_PRONTA→MONTAGEM→CONTROLE_QUALIDADE→PRONTO_PARA_RETIRADA→ENTREGUE (+CANCELADO,DEVOLVIDO_GARANTIA,RETRABALHO)` — ver `visionbox-especificacao.md:268`

| ID | US | MoSCoW | Compl | Aceite | Status |
|---|---|---|---|---|---|
| US06 | Mover OS entre status com validação e log quem/quando/motivo | MUST | L | Transição inválida `422`, todo movimento gera `EventoOS` timeline imutável, `RETRABALHO→EM_PRODUCAO` reinicia `previsao` | `todo` |
| US07 | Ver Kanban/Lista OS por status com SLA vermelho | MUST | M | Filtros loja/vendedor/cliente/atraso, `previsaoEntrega` em vermelho se <24h, `idx_os_atrasadas` | `todo` |
| US08 | Notificar cliente WhatsApp ao ir para `PRONTO_PARA_RETIRADA` | SHOULD | S | Botão `wa.me` com mensagem pronta (auto em F2) | `todo` |

### F1-E4 Estoque

| ID | US | Compl | Aceite | Status |
|---|---|---|---|---|
| US09 | Reservar/baixar estoque ao aprovar OS e estornar ao cancelar | M | `estoque.reservado` cria movimento `Reservado`, baixa só em `ENTREGUE`, `CHECK quantidade>=0` | `todo` |

### F2 — Produção & Lab

| ID | US | MoSCoW | Aceite | Status |
|---|---|---|---|---|
| US10 | Lab terceirizado recebe OS em portal token e atualiza `EM_PRODUCAO` | MUST | Token por OS + lote, sem login para single | `backlog` |
| US11 | Técnico vê fila `EM_PRODUCAO`, aponta início/fim, reprova CQ com foto | MUST | Reprovação → `RETRABALHO` exige foto | `backlog` |
| US12 | Sistema dispara WhatsApp auto a cada transição crítica 5/9/10 | SHOULD | Z-API/Meta Cloud, log entrega, opt-out | `backlog` |

### F3 — Financeiro & CRM

| ID | US | MoSCoW | Aceite | Status |
|---|---|---|---|---|
| US13 | Contas Receber/Pagar, conciliação OFX, DRE por loja/OS | MUST | `DRE = receita OS - custo - comissão` | `backlog` |
| US14 | Régua cobrança PIX boleto + negativação | MUST | D+1 WhatsApp, D+7 boleto | `backlog` |
| US15 | Campanha "seu óculos faz 1 ano" + NPS pós-entrega | SHOULD | Segmentação grau/compra, open >25% | `backlog` |

### F4 — Inteligência

| ID | US | MoSCoW | Status |
|---|---|---|---|
| US16 | BI giro armação, lente mais vendida, margem vendedor, ABC | MUST | `backlog` |
| US17 | Cliente vê rastreio + 2ª via garantia (PWA) | COULD | `backlog` |

## Sprint Backlog Detalhado (S0–S3)

### S0 Foundation (W1-2) — sem feature, só risco

- [ ] S0-01 Setup repo + CI + `EntidadeBase` + `TenantContext` + RLS + `LogAuditoria` + `Outbox/Idempotency` + `ProblemDetail` — **M**
- [ ] S0-02 `Flyway V1–V11` + `docker-compose.dev.yml` (PG15, Redis, Rabbit, MinIO) — **M**
- [ ] S0-03 Event Storming OS 12 status + `TransicaoOSRegistry` contrato — **S**
- [ ] S0-04 Protótipo Figma Orçamento→Kanban validado com 3 óticas — **S**
- [ ] S0-05 Contrato CSV + decisão gateway PIX — **S**

### S1 Cliente (W3-4)

- [ ] S1-01 US01 Cliente+Receita + `CpfConverter AES-GCM + cpf_hash` + `GrauValidator` — **M**
- [ ] S1-02 US02 Produto single-table + `MapStruct` polimórfico + cache Redis `catalogo:*` — **M**
- [ ] S1-03 Auth `Usuario/Perfil` + JWT access 15m/refresh httpOnly + RBAC matrix — **M**

### S2 Receita+Catálogo (W5-6)

- [ ] S2-01 Receita `od/oe_cipher` + upload S3 presigned + job recall query — **M**
- [ ] S2-02 Catálogo grid filtros + `pg_trgm` — **S**

### S3 PDV+OS (W7-9)

- [ ] S3-01 US04 PDV + cálculo `BigDecimal` + idempotência + `sequencia_os` — **L**
- [ ] S3-02 US06 StateMachine + `EventoOS` + `StatusOSAlteradoEvent → outbox` — **L**
- [ ] S3-03 US07 Kanban + `SlaMetrics` + polling — **M**

## Critérios de Priorização

1. Desbloqueia OS? → MUST
2. Evita vazamento LGPD/tenant? → MUST Fase 0
3. Valida AHA (orçamento 3min)? → MUST
4. Custo de adiar > custo de fazer? → SHOULD
5. Só escala? → COULD/WON'T

> **Atualizar `Status` aqui + em `.visionbox/state.json` a cada daily. PR deve referenciar US ID (ex: `feat(US04): PDV`).

## Pós-MVP / M2 — Deploy Produção + Piloto 2 Óticas

> Fonte operacional: `docs/PILOTO_M2.md`. Esta seção não altera a spec congelada; apenas organiza o backlog de validação do marco M2.

| ID | Item | Dono sugerido | MoSCoW | Compl | Aceite | Status |
|---|---|---|---|---|---|---|
| M2-01 | Selecionar e formalizar 2 óticas piloto com responsáveis, agenda e critério de sucesso | product-manager | MUST | S | Termo piloto assinado, contatos definidos e compromisso de operar VisionBox como fonte principal por 14 dias | `todo` |
| M2-02 | Preparar ambiente de produção assistida com healthcheck, backup, restore drill e rollback | devops-infra/db-admin | MUST | M | Health 200, restore testado, procedimento de rollback documentado e sem processo manual obscuro | `todo` |
| M2-03 | Executar carga inicial de clientes, produtos, usuários e estoque mínimo por loja | db-admin/backend-engineer | MUST | M | Amostra validada por gerente, erros de importação registrados e nenhum dado sensível exposto em plain | `todo` |
| M2-04 | Rodar UAT guiado por perfil antes do go-live | qa-engineer/frontend-engineer | MUST | S | Vendedor, técnico, financeiro e gerente concluem fluxos obrigatórios com evidência | `todo` |
| M2-05 | Operar piloto assistido por 14 dias e medir KPIs M2 | product-manager/customer-support-specialist | MUST | M | >=30 OS reais por loja, >=90% timeline completa, incidentes registrados e review semanal feito | `todo` |
| M2-06 | Fechar relatório Go/No-Go para M3 Beta 10 lojas | product-manager | MUST | S | Relatório M2 com métricas, aprendizados, top 10 melhorias e decisão Go/No-Go | `todo` |
