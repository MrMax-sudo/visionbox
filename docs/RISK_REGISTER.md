# VisionBox — Registro de Riscos

> Revisado quinzenalmente + a cada sprint review. `Prob: A/M/B`, `Impacto: A/M/B`.

| # | Risco | Prob | Imp | Tipo | Impacto | Mitigação (A) | Contingência (B) | Dono | Status |
|---|---|---|---|---|---|---|---|---|---|
| R1 | Concorrente preço menor já "bom o suficiente" | A | A | Mercado | Churn CAC alto | Vender outcome rastreio+DRE por OS, não feature | Nicho lab próprio paga mais | PO | `monitorando` |
| R2 | Kanban 12 status complexo vendedor abandona | M | A | UX | Volta planilha | S0 valida 3 óticas, 4 status visíveis + avançado | Flag simplifica para 6 status | UX | `mitigando` |
| R3 | WhatsApp custo/bloqueio | M | A | Técnico | Diferencial não funciona | MVP manual `wa.me`, F2 Meta Cloud API | Fallback SMS+link rastreio | Backend | `mitigando` |
| R4 | CSV sujo 10 anos importação | A | M | Ops | TTV >48h | Template + erro linha-a-linha | Concierge import 10 primeiras | PO | `aberto` |
| R5 | Ótica sem processo culpa sistema | A | M | Produto | Sistema culpado por bagunça | Playbook BPMN padrão VisionBox | Indicar parceiro implantação | PO | `aberto` |
| R6 | Scope creep NF-e no MVP | A | M | Escopo | Atraso 6 sem | Integrar parceiro fiscal, não construir | Ter eNotas homologado | Fiscal | `vigilante` |
| R7 | LGPD receita sensível multa 2% faturamento | B | A | Legal | Multa+reputação | Cipher+RLS+audit+consentimento S0 | DPO + DPIA | Security | `mitigando` |
| R8 | Vazamento tenant `loja_id` | B | A | Sec | Vazamento inter-loja | `@TenantId+RLS+CrossTenantTest` S0 | Bloqueio deploy | Security/DBA | `mitigando` |
| R9 | Supply chain CVE pgcrypto/Boot | M | A | Sec | RCE | Pinar PG≥15.16 Boot≥3.5.14 + trivy/SBOM | Patch emergencial | DevOps | `mitigando` |
| R10 | Backup nunca testado | M | A | Infra | RPO não cumpre | `restore-drill` mensal | Manual DR | DBA | `aberto` |

**Top 3 vigilância semanal:** R2 (adopt Kanban), R1 (win/loss), R3 (custo WhatsApp). Atualizar `Status: aberto→mitigando→resolvido→aceito`.

