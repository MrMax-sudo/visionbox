# P1 — Draft de reconstrução das migrations ausentes (V3–V10)

> **STATUS: DRAFT NÃO VALIDADO. NÃO mover para `src/main/resources/db/migration/` sem validação em Postgres real.**
> Origem: análise do bloqueio P1 (2026-10-08). Entregue pelo orquestrador para o **db-admin** validar e finalizar.
> Referência: `docs/PROGRESS.md`, `.visionbox/state.json` (`p1_blocker`), ADR-001, D-004.

## 1) O problema (fatos apurados no repo)

- As migrations `V3`..`V10` **nunca existiram no histórico git**. A numeração pula de `V2` para `V11`.
- Hoje o repo é Flyway-clean **apenas sobre um banco que já tem o schema legado** criado fora do Flyway
  (Hibernate `ddl-auto` em dev / provisionamento externo). Ver comentário de `V24__unicidade_parcial_produto_sku.sql:15`.
- Num banco **limpo** (`flyway migrate` do zero), a cadeia **quebra já na `V2`**:

  `V2__cliente_receita.sql` assume que já existem:
  - `fn_set_atualizado_em()` — usada nos triggers de `cliente`/`receita` (`V2:83,160`);
  - `sequencia_numeracao` — `ENABLE/FORCE RLS` + policy (`V2:179-197`);
  - `perfil`, `usuario`, `usuario_loja` — `GRANT SELECT` (`V2:235-237`);
  - `fn_next_sequencia(uuid,varchar,int)` — `GRANT EXECUTE` (`V2:231`).

  Nenhuma delas é criada antes da `V2` (`usuario` só nasce na `V13`, *depois* de V2).

- Tabelas de entidade **sem `CREATE TABLE` em nenhuma migration** (5):
  `produto`, `marca`, `categoria`, `pedido_venda`, `item_pedido`.

- `ordem_servico` (criada na `V1`) **não tem** as colunas que a entidade `OrdemServico` e o BI usam:
  `cliente_id`, `receita_id`, `armacao_id`, `lente_id`, `laboratorio_id`.
  (O `RelatorioBiRepository` faz `JOIN produto pr ON pr.id = os.armacao_id/lente_id`.)

- `app.current_loja_id()` (usada por V12..V30) é definida na **V11** — ok, pois V11 < V12.

## 2) Arquivos deste draft

| Arquivo | Versão Flyway | Conteúdo | Roda antes de |
|---|---|---|---|
| `V1_1__legacy_foundation.sql` | **1.1** | `fn_set_atualizado_em`, `sequencia_numeracao`+`fn_next_sequencia`, `perfil`, `usuario`, `usuario_loja` | **V2** |
| `V3__catalogo.sql` | 3 | `produto`, `marca`, `categoria` | V11 (RLS) / V18 / V24 |
| `V4__pedido_venda.sql` | 4 | `pedido_venda`, `item_pedido` | V11 (RLS) |
| `V5__ordem_servico_colunas.sql` | 5 | `ALTER ordem_servico ADD` colunas de vínculo | V30 (BI) |

### Por que `V1_1` (versão 1.1) e não `V3`?
A `V2` precisa de `fn_set_atualizado_em`, `sequencia_numeracao`, `perfil`, `usuario`, `usuario_loja`.
Uma migration `V3+` roda **depois** da V2 e não resolve. A versão **1.1** (`V1_1`) ordena
`1 < 1.1 < 2`, então roda **entre** a V1 e a V2 — sem tocar na V2 nem no checksum dela.

## 3) Decisões que o db-admin precisa fechar

1. **Numeração final.** Confirmar `V1_1` (1.1) para a fundação. Alternativas: renumerar toda a
   cadeia (mais invasivo) ou colapsar tudo num único `V1` autoconsistente (e re-baselinar).
2. **`item_pedido` sem `loja_id`.** A entidade `PedidoVenda.ItemPedido` **não** estende `EntidadeBase`,
   logo não tem `loja_id` — isso **viola a regra R1** (toda tabela com `loja_id`). O isolamento hoje
   seria via `pedido_id` (pai). Decidir: (a) aceitar exceção documentada, ou (b) adicionar `loja_id`
   na entidade + tabela (mudança de código). **Não alterar entidade sem PR/aprovação.**
3. **`perfil` e `usuario_loja`.** Não têm entidade JPA; existem só para satisfazer os `GRANT` da V2.
   `perfil` é seed global (sem `loja_id`); auto-consumo atual é via **enum Java** `Perfil`.
   Confirmar que continuam como tabela (ou remover referências da V2 — mais arriscado).
4. **CHECK de `usuario.perfil`.** A V13 restringe a 7 valores (`V13:18`) mas o enum tem **8**
   (inclui `DESENVOLVEDOR`, Fase 3). O draft da fundação já inclui `DESENVOLVEDOR`; verificar se é
   preciso `ALTER` no CHECK em banco já existente. **Bug latente**: sem isso, criar usuário
   `DESENVOLVEDOR` viola a constraint.
5. **Fiscal/colunas extras da V18.** `V18` adiciona `ncm/cest/cfop/cbenef` em `produto` de forma
   condicional (`IF EXISTS`). No draft, `produto` já nasce com essas colunas — a V18 vira no-op.
   Confirmar ordem/estratégia.
6. **Índices/constraint names** (`uk_*`) — conferir contra o que o Hibernate gera hoje no banco real
   para evitar duplicidade/erro de `validate`.

## 4) Como aplicar (quando houver Postgres — NÃO executar neste PC, sem Docker)

**Banco LIMPO (novo cliente/piloto):**
```
# copiar arquivos para src/main/resources/db/migration/ após revisão
flyway -url=... migrate
flyway -url=... validate
mvn test -Pintegration      # Testcontainers (IsolamentoTenantTest, IdempotenciaPDVTest)
```

**Banco EXISTENTE (schema legado já aplicado):**
```
# 1) rodar o DDL manualmente (é idempotente: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
# 2) realinhar o histórico:
flyway -url=... repair
flyway -url=... info
flyway -url=... migrate    # se ainda faltar algo
```
Flyway verá versões "descobertas mas não aplicadas" abaixo da atual → exige `repair` e/ou
`outOfOrder=true`. **Validar em banco de rascunho antes de tocar produção.**

## 5) Checklist de aceite (db-admin)

- [ ] `flyway migrate` do zero conclui sem erro (V1→V30).
- [ ] `flyway validate` ok (`mvn flyway:validate`).
- [ ] `mvn test -Pintegration` verde (PG real via Testcontainers).
- [ ] `IsolamentoTenantTest` cobre as novas tabelas (RLS da V11 aplicada em produto/marca/categoria/pedido_venda).
- [ ] `mvn test` (unit) continua 225/225.
- [ ] Decisões do item 3 registradas em ADR/`docs/decisions.md`.
- [ ] Atualizar `docs/PROGRESS.md` + `.visionbox/state.json` e remover o `p1_blocker`.

---

### Aviso
Estes SQLs foram **inferidos das entidades JPA** (`EntidadeBase` + `Produto`/`Marca`/`Categoria`/
`PedidoVenda`) e do consumo real em migrations/queries. **Não foram executados** contra nenhum
Postgres. Tratar como especificação revisável, não como migration pronta.