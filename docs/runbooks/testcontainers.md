# Runbook — Testcontainers & CI

## Como rodar local

```bash
docker compose -f docker-compose.dev.yml up -d   # sobe PG15+Redis+Rabbit+MinIO
mvn test -Punit-only                              # <30s
mvn verify -Pintegration -Dtestcontainers.reuse.enable=true  # PG real via Testcontainers
```

`application-test.yml` usa `jdbc:tc:postgresql:15-alpine:///visionbox_test?TC_REUSABLE=true&TC_DAEMON=true` com `hikari maxPool 5` e `.testcontainers.properties` `reuse.enable=true`.

## Por que falhou no Windows

`//./pipe/docker_engine: not found` — Docker Desktop parado, WSL integration desligada, context errado. Use `ubuntu-latest` no CI. Reuso `postgres:15-alpine` reaproveitado ~300ms vs 3-5s cold.

Troubleshooting: `docker rm --filter label=org.testcontainers.reuse=true`, verificar Ryuk porta 5432, Hikari 5.

