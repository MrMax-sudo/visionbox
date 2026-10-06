# Runbook — Incidente LGPD / Vazamento

1. **Detectar** <72h: SIEM `cross_tenant_attempt>5/5m` ou `log_auditoria DENIED`.
2. **Conter:** revoke `jti` família, `SET app.loja_id` bloqueio, isolar PG replica.
3. **Avaliar:** DPO classifica risco, coleta `traceId`+`log_auditoria`.
4. **Notificar:** ANPD + titular se risco relevante art.48 (prazo legal).
5. **Remediar:** patch + `RewrapJob` se cipher, `RISK_REGISTER.md` + ADR.
6. **Lições:** retro + evidência em `PROGRESS.md`.

