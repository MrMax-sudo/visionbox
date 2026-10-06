# ADR-003 — Retenção Fiscal 5 anos vs Direito de Exclusão LGPD

- **Data:** 2026-09-05
- **Status:** Aceito
- **Contexto:** SEFAZ/CTN art.174 exige reter NF 5 anos; LGPD art.16/18 garante exclusão.
- **Decisão:** Exclusão ≠ DELETE se há `ordem_servico` com `documento_fiscal` <5a: **anonimização lógica** (`nome→ANONIMIZADO <hash>`, `cpf_cipher null`, `od/oe_cipher null`, mantém `loja_id+valor+NF`). Sem NF e sem garantia → hard delete permitido. Fluxo `POST /lgpd/solicitacoes {ACESSO|EXCLUSAO|REVOGACAO}` com workflow DPO. ROPA = `log_auditoria+consentimento`, DPIA obrigatório.
- **Consequências:** Partição retenção 5a fiscal + 2a clínico, `Object Lock Compliance 5a` no bucket fiscal.

