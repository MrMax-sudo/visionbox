# Runbook — Backup & Restore

- **Backup:** `pgBackRest` base diária 02:00 + WAL `archive_command aws s3 cp %p s3://visionbox-backups/wal/%f`, base 7d WAL 30d mensal 12m Glacier, `AES256 + Object Lock Compliance 5a`.
- **Restore PITR:** `pgBackRest --stanza=visionbox --type=time --target="2026-06-20 14:35:00" restore` + `flyway validate` + `SELECT count(*) FROM ordem_servico`.
- **Drill:** CronJob mensal sobe PG efêmero restaura `base+WAL until now()-1h`, RTO<30m RPO<5m.
- **Archival:** `DETACH partition >60m → COPY CSV → S3 Glacier → DROP`.

