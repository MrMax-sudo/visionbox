# Runbook — Deploy Produção / Piloto M2

> Objetivo: colocar o VisionBox em produção controlada para 2 óticas piloto, com rollback claro, backup restaurável e observabilidade mínima.

## Pré-requisitos

- CI verde em `main`: `mvn verify -Pintegration`, `flyway validate`, `npm run build` e Trivy sem HIGH/CRITICAL.
- Imagem publicada em `ghcr.io/techboxbr/visionbox` com tag imutável por SHA.
- Banco PostgreSQL 15 provisionado com PITR ativo, TLS em trânsito e storage criptografado.
- Redis, RabbitMQ e S3/MinIO produtivos provisionados fora do host da aplicação.
- Secrets fora do git: `JWT_SECRET`, `CRYPTO_KEK_HEX`, `CRYPTO_HMAC_PEPPER`, credenciais PostgreSQL, RabbitMQ, Redis e S3.
- DNS, TLS e healthcheck `/actuator/health` configurados antes da primeira ótica piloto.

## Variáveis Obrigatórias

| Variável | Origem | Observação |
|---|---|---|
| `SPRING_PROFILES_ACTIVE=prod` | ambiente | Nunca usar `dev` em produção |
| `SPRING_DATASOURCE_URL` | secret/env | PostgreSQL com SSL |
| `SPRING_DATASOURCE_USERNAME` | secret | Usuário app sem permissões de superuser |
| `SPRING_DATASOURCE_PASSWORD` | secret | Rotacionável |
| `SPRING_DATA_REDIS_HOST` | secret/env | Redis privado |
| `SPRING_RABBITMQ_HOST` | secret/env | RabbitMQ privado |
| `SPRING_RABBITMQ_USERNAME` | secret | Sem usuário default |
| `SPRING_RABBITMQ_PASSWORD` | secret | Rotacionável |
| `AWS_S3_ENDPOINT` | env | S3 compatível ou AWS S3 |
| `JWT_SECRET` | secret | 32 bytes ou superior |
| `CRYPTO_KEK_HEX` | secret/KMS | 256-bit hex, gerenciado por KMS/Vault |
| `CRYPTO_HMAC_PEPPER` | secret | Nunca reaproveitar valor dev |

## Deploy

1. Confirmar SHA aprovado:

   ```bash
   git rev-parse HEAD
   ```

2. Validar migrations contra banco de staging com snapshot recente:

   ```bash
   mvn flyway:validate -Dflyway.url="$SPRING_DATASOURCE_URL" -Dflyway.user="$SPRING_DATASOURCE_USERNAME" -Dflyway.password="$SPRING_DATASOURCE_PASSWORD"
   ```

3. Aplicar migrations em janela assistida:

   ```bash
   mvn flyway:migrate -Dflyway.url="$SPRING_DATASOURCE_URL" -Dflyway.user="$SPRING_DATASOURCE_USERNAME" -Dflyway.password="$SPRING_DATASOURCE_PASSWORD"
   ```

4. Publicar a imagem por tag imutável e aguardar healthcheck `UP`.

5. Executar smoke pós-deploy:

   ```bash
   curl -fsS https://app.visionbox.com.br/actuator/health
   curl -fsS https://app.visionbox.com.br/v3/api-docs >/dev/null
   ```

## Smoke Funcional M2

- Login ADMIN da ótica piloto retorna access token e refresh httpOnly.
- Criar cliente com CPF cifrado e confirmar que resposta do perfil VENDEDOR mascara CPF.
- Criar OS em `ORCAMENTO`, avançar uma transição válida e confirmar `EventoOS`.
- Finalizar venda com `Idempotency-Key` e repetir a requisição para confirmar resposta idempotente.
- Emitir NFC-e pelo provider mock/homolog configurado e confirmar registro em `documento_fiscal`.
- Desligar integração externa simulada e confirmar que outbox mantém eventos pendentes sem travar PDV.

## Rollback

- Preferir rollback de aplicação para a tag anterior quando não houver migration destrutiva.
- Se migration nova foi aplicada, usar script de compensação versionado ou restaurar snapshot/PITR conforme `backup-restore.md`.
- Nunca executar `git reset --hard` ou alterar histórico para rollback operacional.
- Após rollback, validar:

  ```sql
  select count(*) from ordem_servico;
  select status, count(*) from outbox_message group by status;
  ```

## Observabilidade Mínima

- Logs estruturados sem `authorization`, CPF, grau ou tokens.
- Alertas:
  - `/actuator/health` != `UP` por 2 minutos.
  - fila outbox com mensagens pendentes por mais de 10 minutos.
  - erro fiscal acima de 2% em 15 minutos.
  - job SLA/recall sem execução por 2 ciclos.
- Métricas para piloto:
  - tempo de orçamento até OS confirmada.
  - OS atrasadas por loja.
  - taxa de transições inválidas.
  - vendas offline sincronizadas.

## Critério de Go/No-Go

Go somente se:

- Backup restaurado em ambiente efêmero no mês corrente.
- Tenant leak test executado com sucesso.
- Usuários piloto provisionados com roles mínimas.
- DPIA revisada para dados de saúde e consentimento de recall.
- Plano de suporte do primeiro dia definido com responsável e janela de atendimento.
