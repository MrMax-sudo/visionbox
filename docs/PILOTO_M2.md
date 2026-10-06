# VisionBox — Plano M2 Deploy Producao + Piloto 2 Oticas

> **Marco:** M2 — MVP Piloto 2 oticas  
> **Data alvo:** 2026-11-07  
> **Base:** MVP completo em 2026-09-05, Fase 1-3 concluida em `docs/PROGRESS.md` e `.visionbox/state.json`  
> **Objetivo:** colocar 2 oticas reais operando VisionBox em producao assistida, validando PDV, OS/Kanban, financeiro basico, rastreabilidade e rotina operacional.

## 1. Resultado Esperado

O piloto M2 deve provar que o VisionBox consegue substituir a rotina diaria essencial de uma otica sem depender de planilhas paralelas para venda, OS e acompanhamento de entrega.

**North Star do piloto:** `OS entregues no prazo / loja / mes`.

**Meta M2:** 2 oticas ativas por pelo menos 14 dias corridos, com minimo de 30 OS reais por loja no periodo e 90% das OS com timeline completa ate `PRONTO_PARA_RETIRADA` ou `ENTREGUE`.

## 2. Hipoteses De Produto

| ID | Hipotese | Como validar | Decisao esperada |
|---|---|---|---|
| H1 | Vendedor consegue registrar cliente, receita, produto e OS sem suporte presencial continuo | 5 vendas reais acompanhadas por loja com tempo e duvidas anotadas | Ajustar onboarding ou manter fluxo |
| H2 | Kanban 12 status melhora rastreabilidade sem pesar na operacao | 80% das OS movidas no dia correto e entrevistas semanais com vendedores/oticos | Simplificar status visiveis ou manter configuracao |
| H3 | Financeiro por OS reduz divergencia no fechamento | Fechamento diario conferido com caixa real por 10 dias uteis | Priorizar conciliacao ou manter financeiro basico |
| H4 | WhatsApp manual `wa.me` e suficiente para M2 | Pelo menos 70% das OS prontas notificadas pelo fluxo manual | Antecipar WhatsApp real se uso for baixo |
| H5 | Dados sensiveis ficam operaveis com mascaramento por perfil | Auditoria de perfis e feedback de vendedor/gerente | Ajustar permissoes, nunca relaxar LGPD |

## 3. Escopo Do Piloto

### Incluido

| Area | Escopo M2 | Evidencia |
|---|---|---|
| Deploy | Ambiente producao assistida com backup, healthcheck, logs e rollback documentados | URL, health 200, checklist DevOps |
| Onboarding | Carga inicial de clientes, produtos, usuarios e estoque minimo de 2 oticas | Relatorio de importacao e amostra validada |
| PDV/OS | Orçamento, venda, criacao de OS, pagamentos e idempotencia | Video curto por otica + logs |
| Kanban/SLA | Movimentacao de OS, timeline, atrasadas e status por laboratorio | Screenshot Kanban + extrato EventoOS |
| Financeiro | Contas a receber/pagar, parcelas e DRE basica por loja | Fechamento diario comparado |
| Fiscal | Mock/homologacao fiscal conforme configuracao atual, sem promessa de NFC-e producao real | Registro de limitacao aceito |
| Suporte | Canal unico de suporte, triagem diaria e registro de incidentes | Planilha/chamados M2 |
| Metricas | Coleta dos KPIs definidos em `docs/METRICS.md` | Baseline e leitura semanal |

### Fora Do Escopo

| Item | Motivo |
|---|---|
| WhatsApp automatico Z-API/Meta | Pos-MVP P2; M2 valida fluxo manual e necessidade real |
| Lab API real | Pos-MVP P2; piloto usa acompanhamento interno/manual |
| Portal Cliente PWA e WebAR | Pos-MVP P3; nao bloqueiam operacao assistida |
| SefazDiretoProvider producao | Pos-MVP P2; depende de credenciais/certificados e homologacao fiscal |
| App mobile nativo | Pos-MVP P4 |

## 4. Criterios Para Selecionar As 2 Oticas

| Criterio | Minimo |
|---|---|
| Volume | 60+ OS/mes ou fluxo diario suficiente para gerar aprendizado em 14 dias |
| Patrocinador | Dono/gerente disponivel para review semanal |
| Processo | Aceita operar PDV + Kanban no VisionBox como fonte principal durante piloto |
| Dados | Fornece cadastro/produtos em CSV ou permite carga assistida |
| Infra | Internet estavel, navegador moderno, impressora/rotina fiscal mapeada |
| LGPD | Concorda com termo de tratamento, perfis de acesso e regras de suporte |

## 5. Workstreams Paralelos

| Frente | Dono sugerido | Entregas | Gate |
|---|---|---|---|
| Produto e Piloto | `product-manager` | Roteiro M2, selecao das oticas, agenda de treinamento, aceite | Kickoff assinado |
| Infra/Deploy | `devops-infra` | Ambiente prod, backup, restore drill, observabilidade minima | Health + rollback testado |
| Backend | `backend-engineer` | Parametros por loja, seeds reais, ajustes bloqueantes de API | Smoke API por loja |
| Banco | `db-admin` | Backup/PITR, RLS validada, importacao inicial e indices basicos | Restore e tenant check |
| Frontend/UX | `frontend-engineer` + `ux-designer` | Fluxo treinamento, estados Loading/Empty/Error/Offline, ajustes de friccao | Demo vendedor sem ajuda |
| Fiscal | `fiscal-engineer` | Mapa de limites fiscal M2, configuracao homolog/mock, riscos Sefaz | Termo de limitacao |
| QA | `qa-engineer` | Suite smoke, roteiro UAT, regressao PDV/OS/tenant | Go/No-Go verde |
| Seguranca/LGPD | `security-auditor` | Checklist acesso, logs sem dados sensiveis, DPIA light | Sem blocker LGPD |
| Suporte | `customer-support-specialist` | Base rapida, fluxo de chamado, scripts de atendimento | SLA suporte ativo |

## 6. Plano De Execucao

| Semana | Objetivo | Saida |
|---|---|---|
| W1 | Fechar oticas piloto, responsaveis e agenda | Termo piloto + contatos + criterio de sucesso |
| W2 | Preparar producao assistida e dados de onboarding | Ambiente pronto + carga inicial validada |
| W3 | Treinar usuarios e executar UAT guiado | Checklist UAT por perfil |
| W4-W5 | Operar piloto assistido 14 dias | Daily de incidentes + metricas reais |
| W6 | Review Go/No-Go para beta 10 lojas | Relatorio M2 + backlog priorizado M3 |

## 7. Roteiro De Treinamento

| Perfil | Fluxos obrigatorios |
|---|---|
| Vendedor | Login, cliente, receita, produto, venda, pagamento, criar OS, WhatsApp manual |
| Otico/Tecnico | Kanban, avancar status, registrar motivo, retrabalho, CQ |
| Financeiro | Contas a receber, baixa, parcelas, DRE basica |
| Gerente/Admin | Usuarios, permissoes, acompanhamento de SLA, fechamento diario |

## 8. Metricas E Instrumentacao

| Metrica | Alvo M2 | Fonte |
|---|---|---|
| OS reais criadas | >=30 por loja em 14 dias | `ordem_servico` |
| OS com timeline completa | >=90% | `evento_os` |
| Tempo medio de orcamento | <3min em fluxos acompanhados | observacao + timestamp |
| OS perdidas/canceladas sem motivo | <5% | `ordem_servico` + motivo |
| Divergencia fechamento diario | <=2 ocorrencias por loja no piloto | financeiro x caixa real |
| Outbox pendente | 0 pendente critico >15min | metricas/outbox |
| Fiscal contingencia pendente | 0 >15min quando aplicavel | `documento_fiscal` |
| Incidentes P0/P1 | 0 P0, P1 resolvido <24h | registro suporte |
| Satisfacao usuario piloto | CSAT >=4/5 | entrevista semanal |

## 9. Riscos M2

| Risco | Severidade | Mitigacao | Dono |
|---|---|---|---|
| Kanban 12 status gerar abandono operacional (`R2`) | Alta | Treinamento por papel, status visiveis por etapa e review diario das OS paradas | Produto/UX |
| WhatsApp manual reduzir valor percebido (`R3`) | Alta | Mensagens prontas, medicao de uso e gatilho para antecipar integracao real | Produto/Backend |
| CSV/carga inicial atrasar time-to-value (`R4`) | Media | Template unico, saneamento assistido e corte de escopo de dados historicos | Produto/DBA |
| Processo da otica estar desorganizado (`R5`) | Media | Playbook operacional minimo antes do go-live | Produto/Suporte |
| Falha backup/restore em producao assistida (`R10`) | Alta | Restore drill antes do primeiro dado real | DevOps/DBA |
| Vazamento tenant ou dado sensivel (`R7/R8`) | Alta | Checklist RLS, perfis, mascaramento e logs auditados antes de go-live | Seguranca/DBA |
| Fiscal real ser confundido com escopo M2 | Media | Termo explicito: M2 nao promete NFC-e producao real sem homologacao fiscal | Produto/Fiscal |

## 10. Criterios De Aceite Do Piloto

M2 pode ser marcado como concluido quando todos os criterios abaixo estiverem atendidos:

- [ ] 2 oticas reais cadastradas, com usuarios por perfil e dados iniciais revisados.
- [ ] Ambiente de producao assistida com healthcheck, backup e rollback documentados.
- [ ] Cada otica operou por 14 dias corridos usando VisionBox como fonte principal para PDV + OS.
- [ ] Cada otica criou pelo menos 30 OS reais no periodo.
- [ ] Pelo menos 90% das OS do piloto possuem timeline com `EventoOS` rastreavel.
- [ ] Nenhum incidente P0 aberto e nenhum blocker LGPD/tenant pendente.
- [ ] Fechamento financeiro diario revisado em pelo menos 10 dias uteis por otica.
- [ ] UAT por perfil concluido com aceite de gerente/dono.
- [ ] Relatorio final M2 registrado com metricas, aprendizados, top 10 melhorias e decisao Go/No-Go para M3.

## 11. Decisoes Registradas

| Decisao | Justificativa |
|---|---|
| M2 valida operacao real antes de novas features P2/P3 | MVP ja esta completo; o maior risco agora e adocao e processo |
| WhatsApp automatico fica fora do M2 salvo falha clara do fluxo manual | Evita antecipar integracao paga antes de medir necessidade |
| Fiscal producao real nao e criterio obrigatorio do M2 | Reduz risco regulatorio e evita confundir piloto operacional com homologacao fiscal |
| Backlog M2 prioriza onboarding, deploy, suporte e observabilidade | Estes itens destravam piloto e reduzem risco de abandono |

## 12. Go/No-Go Para M3

**Go para M3** se: criterios de aceite M2 fechados, CSAT >=4/5, sem P0/P1 recorrente, e pelo menos uma das oticas declarar que continuaria usando o VisionBox no mes seguinte.

**No-Go / repetir piloto** se: vendedores mantiverem planilha paralela como fonte principal, timeline OS ficar abaixo de 70%, ou houver incidente LGPD/tenant/fiscal sem correcao validada.
