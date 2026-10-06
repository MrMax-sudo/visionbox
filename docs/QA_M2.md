# VisionBox — QA M2 Piloto

> Plano executavel para aumentar cobertura dos riscos pós-MVP antes do piloto em 2 oticas.

## Escopo

Riscos priorizados: tenant leak, idempotencia PDV/offline, fiscal mock/contingencia e smoke critico API. Este plano nao altera producao; os testes novos ficam em `src/test/**` e `k6/**`.

## Testes Sem Docker

Comando curto:

```powershell
.\mvnw.cmd test -Punit-only -Dtest=StatusOSTransicaoTest,CpfConverterTest,FiscalServiceTest,MockFiscalProviderTest,OutboxMessageTest
```

Cobertura adicionada:

| Risco | Teste | Evidencia esperada |
|---|---|---|
| Fiscal autorizar indevidamente | `FiscalServiceTest.devePropagarRejeicaoDoProvider` | provider rejeita `539`, resposta fica `REJEITADO` |
| Tenant fiscal ausente | `FiscalServiceTest.semTenantContextDeveFalharFechado` | falha antes de `repository.save` |
| Contrato NFC-e mock | `FiscalServiceTest.deveEmitirNfceAutorizadaComContratoMock` | serie `001`, `lojaId`, cStat `100`, tpEmis `1` |
| Contingencia mock | `MockFiscalProviderTest.contingenciaTpEmis9MantemContratoMinimo` | tpEmis `9`, chave 44, protocolo 15, cStat `100` |
| Cancelamento fiscal | `MockFiscalProviderTest.cancelamentoComJustificativaCurtaDeveRejeitar` | justificativa curta rejeitada |
| Outbox/retry offline | `OutboxMessageTest` | `FAILED` segue pendente; `SENT` encerra pendencia |

## Testes Com Docker/Testcontainers

Nao rodar localmente sem autorizacao para Docker. No CI ou em uma janela autorizada:

```powershell
.\mvnw.cmd verify -Pintegration -Dtest=IsolamentoTenantTest,IdempotenciaPDVTest
```

Execucao focada para o gate RLS:

```powershell
.\mvnw.cmd test -Pintegration "-Dtest=IsolamentoTenantTest" "-Djdk.net.URLClassPath.disableClassPathURLCheck=true"
```

Critérios:

| Risco | Teste | Aceite |
|---|---|---|
| RLS FORCE ausente/incompleto | `IsolamentoTenantTest.migrationDeveHabilitarRlsForceEmCliente` | `cliente` tem RLS enabled, FORCE e policy `loja_isolation` |
| RLS fail-open sem tenant | `IsolamentoTenantTest.appApiSemGucDeveFalharFechado` | role `app_api` sem `app.loja_id` ve 0 linhas |
| Tenant leak SQL direto | `IsolamentoTenantTest.appApiComGucDeveIsolarPorLoja` | SQL sem `WHERE loja_id` ve apenas a loja da GUC |
| Bypass por insert/update cross-tenant | `IsolamentoTenantTest.appApiNaoPodeInserirClienteDeOutroTenant` | `WITH CHECK` bloqueia escrita de outra loja |
| Aspect nao seta GUC transacional | `IsolamentoTenantTest.tenantRlsAspectDeveSetarGucNaTransacao` | metodo `@Transactional` aciona `TenantRlsAspect`, `app.current_loja_id()` bate com `TenantContext` e repo/JPA ve so a loja atual |
| Duplicidade CPF por tenant | `IsolamentoTenantTest` | duplicidade intra-loja bloqueia; cross-loja permite |
| PDV replay | `IdempotenciaPDVTest` | mesma key na mesma loja retorna replay sem duplicar |
| Race duplo clique | `IdempotenciaPDVTest` | 5 requests concorrentes resultam em 1 chave persistida |
| TTL idempotencia | `IdempotenciaPDVTest` | registro expirado pode ser limpo e reprocessado |

Evidencia local em 2026-09-05:

| Comando | Resultado |
|---|---|
| `.\mvnw.cmd test-compile "-Djdk.net.URLClassPath.disableClassPathURLCheck=true"` | BUILD SUCCESS; `IsolamentoTenantTest` compila |
| `.\mvnw.cmd test -Pintegration "-Dtest=IsolamentoTenantTest" "-Djdk.net.URLClassPath.disableClassPathURLCheck=true"` | Bloqueado antes do Spring por ambiente: Testcontainers nao encontrou Docker valido (`DOCKER_HOST tcp://localhost:2375` recusado) |

## Smoke k6 M2

Requer API ja em primeiro plano em `8080`; nao iniciar processo em background.

```powershell
k6 run -e BASE_URL=http://localhost:8080 -e LOJA_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa k6/pdv-smoke.js
```

O smoke valida:

| Fluxo | Aceite |
|---|---|
| `/actuator/health` | responde antes do teste |
| `POST /api/v1/vendas` | `201`, body com `id`, p95 < 300ms |
| Replay PDV | mesma `Idempotency-Key` retorna sucesso/replay |
| Duplo clique | batch paralelo com mesma key nao derruba o PDV |
| Fiscal mock | `POST /api/v1/fiscal/nfce/emitir` retorna `201`, cStat `100`, chave 44, protocolo 15 |

## Gaps Que Exigem Ambiente Real

| Gap | Dono sugerido | Ambiente |
|---|---|---|
| RLS FORCE com usuario `app_api` e `app_readonly` | db-admin + qa-engineer | PostgreSQL 15 real/Testcontainers |
| SefazDiretoProvider, SOAP e assinatura A1 | fiscal-engineer + integration-engineer | Homologacao SEFAZ ambiente 2 |
| Airplane mode fiscal com `PENDENTE_CONTINGENCIA + outbox_fiscal` | fiscal-engineer + qa-engineer | API + banco + fila |
| RabbitMQ publisher/DLQ/backoff | devops-infra + qa-engineer | Docker compose autorizado |
| Carga piloto com dados de 2 lojas | qa-engineer + data-analyst | API staging com seed anonimizado |
