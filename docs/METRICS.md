# VisionBox — Métricas e Dashboards

## North Star

**`OS Entregues no Prazo / loja / mês`** — alvo Fase 1: >150.

## KPIs por Fase

| Fase | KPI | Alvo 90d | Fonte |
|---|---|---|---|
| F1 | OS perdidas | <5% | `ordem_servico status` |
| F1 | Tempo orçamento | <3min | `pedido_venda criado→OS` |
| F2 | Lead time Aprovada→Pronto | -30% | `evento_os` delta |
| F2 | % OS com trilha auditável | 100% | `log_auditoria` |
| F3 | Inadimplência crediário | <4% | `conta_receber vencidos/abertos` |
| F3 | Recompra 12m | >18% | `cliente scoreRecompra` job |
| F4 | Lojas usando BI | >70% | `relatorios` access log |
| Sempre | Fiscal contingência pendente | 0 >15m | `documento_fiscal status` |

## Métricas Técnicas (Micrometer)

| Métrica Prometheus | Alerta |
|---|---|
| `visionbox_os_atrasadas_total{laboratorio}` | >5 por 10m → `OSAtrasadaCritica` |
| `visionbox_outbox_pendente` | >100 por 5m → `OutboxLag` |
| `visionbox_fiscal_contingencia_pendente` | >0 por 15m → `FiscalContingencia` |
| `visionbox_lab_leadtime_seconds(p50,p95)` | — |
| `visionbox_os_em_producao` | — |

## Dashboards Grafana

1. **SLA Lab:** lead time por lab/tipo lente vs previsão, heatmap atrasadas.
2. **PDV:** taxa idempotência hit, outbox lag, contingência pendente.
3. **Multi-loja:** req por `loja_id`, p95 por loja, 5xx por loja.
4. **LGPD:** `leitura_receita por loja`, `cross_tenant_attempt`, `export_csv`.

## Instrumentação

```yaml
management.endpoints.web.exposure.include: health,info,metrics,prometheus,flyway
management.metrics.tags: {loja: "${TENANT_ID:unknown}"}
logging.pattern.console: '{"ts":"%d{ISO8601}","traceId":"%X{traceId}","loja":"%X{lojaId}","msg":"%m"}%n'
```

> Atualizar este arquivo ao atingir cada marco (M2, M3...) com valores reais.

