# P1 — Draft de reconstrução das migrations ausentes (V3–V10)

> **STATUS: APLICADO E VALIDADO EM POSTGRES REAL (2026-10-13).** Banco novo `visionbox_p1` @ `192.168.15.90:5432` (dev): cadeia **V1→V1_1→V2→V3→V4→V5→V11→…→V41 completa, 0 falhas**; `flyway validate` ok (35 migrations); RLS ENABLE+FORCE confirmado em produto/marca/categoria/pedido_venda/item_pedido/ordem_servico_pagamento/conta_receber_pagamento; colunas V37/V40/V41 presentes; 39 tabelas. **Bug encontrado e corrigido na 1ª execução:** `V19__estoque_lote.sql` índice parcial `WHERE validade < CURRENT_DATE` viola 42P17 (função não-IMMUTABLE em predicado de índice) — linha removida (redundante com `idx_estoque_lote_validade`). Checklist restante: Testcontainers `-Pintegration` (Docker) e adoção out-of-order no banco legado real.
> Origem: bloqueio P1 (2026-10-08) · Revisão db-admin: 2026-10-13 · aplicação orquestrador: 2026-10-13 · `.visionbox/state.json` (`p1_blocker`), ADR-001, D-004.

## 1) Estado real verificado no repo (2026-10-13)

- `src/main/resources/db/migration/` contém **V1, V2, V11..V36** — `V3..V10`
  **não existem** (confirmado por glob; o número pula de 2 para 11).
- **Duplicatas V12/V15 RESOLVIDAS**: existe exatamente **um** `V12__estoque.sql`
  e **um** `V15__financeiro_conta_receber.sql`. O aviso em `docs/PROGRESS.md`
  ("V12 ×3 e V15 ×2" → *"Found more than one migration with version"*) está
  **desatualizado** — boot com Flyway não quebra mais por isso.
- **V33/V34/V35/V36** criados por outras frentes da onda atual; o draft **não
  usa esses números** (usa 1.1, 3, 4, 5 — sem colisão).
- Num banco limpo, a cadeia quebra **na V2** (objetos inexistentes) e depois em
  **V18:38** (`CREATE INDEX ... ON produto` fora do DO guard), **V21:4** (FK
  `usuario_refresh_token → usuario`), **V31:19** (`INSERT INTO categoria`) e no
  **BI** (`RelatorioBiRepository` junta `produto` em `os.armacao_id/lente_id`).
- `app.current_loja_id()` (helper das policies) é definido na **V11** —
  qualquer policy criada antes da posição 11 **não pode** usá-lo (ver §3.7).

## 2) Arquivos deste draft

| Arquivo | Versão Flyway | Conteúdo | Roda antes de |
|---|---|---|---|
| `V1_1__legacy_foundation.sql` | **1.1** | `fn_set_atualizado_em`, `sequencia_numeracao`+`fn_next_sequencia`, `perfil`, `usuario`, `usuario_loja` | **V2** (contrato de trigger/RLS/GRANT) |
| `V3__catalogo.sql` | 3 | `produto`, `marca`, `categoria` + índices + triggers | V11 (RLS) / V18 (no-op) / V24 (no-op) / V31 (seed) |
| `V4__pedido_venda.sql` | 4 | `pedido_venda`, `item_pedido` + policy parent-join do item | V11 (RLS de pedido_venda) |
| `V5__ordem_servico_colunas.sql` | 5 | `ALTER ordem_servico ADD` vínculos + `cliente_id SET NOT NULL` | V30 (BI) |
| `CORRECAO_CHECK_USUARIO_PERFIL.md` | — | Documento: bug latente V13/V27 (decisão §3.4) | — |

### Por que `V1_1` (versão 1.1) e não `V3`?
A V2 precisa de `fn_set_atualizado_em`, `sequencia_numeracao`, `perfil`,
`usuario`, `usuario_loja`. Uma migration `V3+` roda **depois** da V2 e não
resolve. A versão 1.1 ordena `1 < 1.1 < 2` (Flyway trata `_` como `.`), então
roda **entre** V1 e V2 — sem tocar na V2 nem no checksum dela.

## 3) Decisões FECHADAS pelo db-admin (2026-10-13)

### 3.1 Numeração final — CONFIRMADO `V1_1` (1.1)
Renumerar a cadeia inteira exigiria re-baseline de todos os ambientes
(mudança de checksum em migrations aplicadas); colapsar tudo num `V1` único
re-escreveria a V1/V2 aplicadas. `V1_1` é aditivo: ambientes existentes não
percebem até adotarem o arquivo (via out-of-order, §5.2).

### 3.2 `item_pedido` sem `loja_id` — IMPEDIMENTO TÉCNICO + mitigação aplicada
**Não é viável adicionar `loja_id UUID NOT NULL` na tabela sem mudar a entidade**
(`PedidoVenda.ItemPedido` não estende `EntidadeBase`): o Hibernate insere sem a
coluna → NULL viola `NOT NULL`; e com a RLS da V11 (varredura dinâmica por
coluna `loja_id`), o `WITH CHECK (loja_id = ...)` rejeitaria **todo INSERT**.
Mudança de código = fora do escopo db-admin (PR do backend-engineer).

**Mitigação DB-layer já no draft (V4):** policy RLS *parent-join* em
`item_pedido` — `USING/WITH CHECK (EXISTS (SELECT 1 FROM pedido_venda pv WHERE
pv.id = item_pedido.pedido_id AND pv.loja_id = NULLIF(current_setting('app.loja_id',
true),'')::uuid))`, coberta por `idx_item_pedido_pedido`, fail-closed sem GUC.
A V11 não cobre `item_pedido` (sem `loja_id`) → esta policy é a definitiva.
Grants `app_*` adicionados na V4 (a V11 não concede nada nessa tabela).

**Correção definitiva (follow-up, não bloqueia P1):** PR backend dando a
`ItemPedido` um `loja_id` populado no `PedidoVendaService.addItem` + migration
de backfill `loja_id = pv.loja_id` + troca da policy parent-join pela canônica
`loja_id = app.current_loja_id()`. Então fechar R1 100%.

### 3.3 `perfil` e `usuario_loja` sem entidade JPA — MANTER como tabela
- `V2:235-237` faz `GRANT SELECT` nelas — sem as tabelas a V2 quebra; editar a
  V2 é mais arriscado (checksum aplicado em todos os ambientes).
- `perfil`: catálogo global (sem `loja_id`/RLS por design); autorização do app
  vem do enum — a tabela serve de contrato e futura UI de perfis.
- `usuario_loja`: N:N usuário×loja para multi-loja futura; tem `loja_id` → RLS
  da V11 cobre automaticamente.

### 3.4 CHECK `usuario.perfil` sem `DESENVOLVEDOR` — RESOLVIDO pela V27
A V27 (já em `db/migration/`) dropa/recria `usuario_perfil_check` com 8 valores.
Bancos com V27 estão imunes; a V1_1 do draft nasce com os 8 valores (mesmo
auto-nome `usuario_perfil_check`), eliminando a janela vulnerável em banco
limpo. SQL de emergência para backups presos na janela V13..V26: ver
**`CORRECAO_CHECK_USUARIO_PERFIL.md`**. Nenhuma migration nova criada.

### 3.5 Colunas fiscais da V18 — ESTRATÉGIA CONFIRMADA
`produto` do draft já nasce com `ncm/cest/cfop/cbenef`; o DO block da V18
(ADD COLUMN condicional) vira no-op e os índices fiscais (`idx_produto_ncm`
etc.) são criados normalmente. Ordem V3 → V18 é a correta.

### 3.6 Nomes de constraints/índices — ALINHADOS
- `uq_produto_loja_sku_ativo` (parcial `WHERE ativo = true`): idêntico à V24 →
  `CREATE UNIQUE INDEX IF NOT EXISTS` da V24 = no-op.
- `uq_usuario_loja_email`: idêntico à V13; comentário da entidade `Usuario`
  referencia esse nome.
- `uk_pedido_venda_loja_numero` = `@Table(uniqueConstraints)` da entidade.
- CHECKs anônimos → auto-nome PG (`usuario_perfil_check` etc.) — os mesmos nomes
  que V13/V27 manipulam. Hibernate `validate` não compara nomes de constraints.

### 3.7 RLS nas tabelas do draft — DONO: V11 (não V3/V4)
O padrão V25 (ENABLE+FORCE+policy inline) **só é viável depois da V11**: a
policy canônica usa `app.current_loja_id()`, criada na V11. Na posição 3/4 a
função não existe; e criar policy com a sintaxe antiga da V2 aqui
**degradaria** o banco existente na adoção out-of-order (substituiria a policy
helper-based da V11 pela versão `current_setting` direto, com a falha de
cast para string vazia). Como `produto`, `marca`, `categoria` e `pedido_venda`
têm `loja_id` e estão na lista explícita da V11, elas recebem ENABLE+FORCE+
policy+grants lá. Exceção: `item_pedido` (sem `loja_id`) — policy própria na
V4, sintaxe posicionalmente válida (§3.2).

### 3.8 FKs — PARIDADE COM O LEGADO (decisão: não criar)
Entidades mapeiam UUIDs puros (sem `@ManyToOne` em `ordem_servico.*`,
`pedido_venda.cliente_id`, `produto.marca_id/categoria_id`) — o schema legado
(Hibernate `ddl-auto`) não tem essas FKs. Criá-las divergiria do legado sem
ganho para o `validate`. `item_pedido.pedido_id` é a exceção: é `@ManyToOne` e
a FK com `ON DELETE CASCADE` é hardening para SQL direto (o Hibernate faz o
cascade em memória sem `@OnDelete`).

### 3.9 `ordem_servico.cliente_id` — NOT NULL (corrigido no draft)
A entidade exige `@Column(nullable = false)`; o draft original adicionava a
coluna como nullable. Corrigido para `ADD COLUMN IF NOT EXISTS` +
`ALTER COLUMN SET NOT NULL` (instantâneo em banco limpo — tabela vazia na
posição 5; no-op em banco legado — coluna já NOT NULL). Falha ruidosa com NULLs
existentes é intencional (backfill antes).

## 4) Divergências aceitas (banco legado vs banco limpo via draft)

| Objeto | Banco limpo (draft) | Banco legado (Hibernate) | Impacto |
|---|---|---|---|
| `produto.tipo_produto` CHECK | presente (5 valores) | ausente (IF NOT EXISTS pula) | nenhum — app valida via enum |
| `item_pedido` RLS | policy parent-join (V4) | **ganha a policy na adoção out-of-order** (hardening novo) | nenhum p/ owner/BYPASSRLS |
| `idx_produto_loja`, `idx_os_*` | criados na V3/V5 | criados na adoção out-of-order | ShareLock breve; usar CONCURRENTLY antes se tabela grande (§5.2 nota) |
| `sequencia_numeracao`/`perfil`/`usuario`/`usuario_loja` | criados na V1_1 | já existem (provisionamento legado) → no-ops | nenhum |

## 5) Como aplicar (quando houver Postgres — NÃO executar neste PC, sem Docker)

### 5.1 Banco LIMPO (novo cliente/piloto) — cadeia completa

```bash
# 1) copiar os 4 .sql do draft para src/main/resources/db/migration/
#    (numeração: V1_1__legacy_foundation.sql, V3__catalogo.sql,
#     V4__pedido_venda.sql, V5__ordem_servico_colunas.sql)
# 2) aplicar
mvn flyway:migrate -Dflyway.url=jdbc:postgresql://$HOST:5432/$DB \
                   -Dflyway.user=$USER -Dflyway.password=$PASS
# 3) validar
mvn flyway:validate -Dflyway.url=... -Dflyway.user=... -Dflyway.password=...
# 4) testes de isolamento com PG real
mvn test -Pintegration   # Testcontainers: IsolamentoTenantTest, IdempotenciaPDVTest
```

Ordem efetiva: **V1 → V1_1 → V2 → V3 → V4 → V5 → V11 → V12 → ... → V36**
(V6..V10 continuam não existindo; numeração Flyway é só ordenação, não exigência
de contiguidade). Pontos de quebra antigos cobertos: V2 (contrato), V12 (estoque
usa produto), V18:38 (índices em produto), V21 (FK usuario), V24 (no-op),
V31 (seed categoria), V30/BI (os.armacao_id/lente_id).

### 5.2 Banco EXISTENTE (schema legado já aplicado; history em ~V36)

O schema legado **já contém** todos os objetos do draft (criados por Hibernate/
provisionamento fora do Flyway). As migrations do draft são idempotentes
(`IF NOT EXISTS`/`ON CONFLICT`) → aplicam como **no-ops** + criação dos índices
auxiliares + policy nova de `item_pedido`.

**IMPORTANTE — o que `flyway repair` faz e NÃO faz:** `repair` realinha
checksums/descrições, remove entradas *failed* e marca migrations ausentes como
deletadas. Ele **NÃO aplica nem registra** as novas versões abaixo da corrente
(1.1/3/4/5) — o mecanismo correto para isso é `outOfOrder=true`. Sem isso, o
boot quebra: `validate-on-migrate: true` + versões resolvidas abaixo da corrente
→ *"Detected resolved migration not applied to database"*.

```bash
# 0) BACKUP OBRIGATÓRIO + parar o app (o validate do boot vai falhar assim que
#    os arquivos entrarem em db/migration)
pg_dump -Fc "$DB" > backup_pre_p1_$(date +%Y%m%d).dump

# 1) copiar os 4 .sql do draft para src/main/resources/db/migration/

# 2) realinhar histórico (se houver checksum/failed pendentes; inofensivo se limpo)
mvn flyway:repair -Dflyway.url=jdbc:postgresql://$HOST:5432/$DB \
                  -Dflyway.user=$USER -Dflyway.password=$PASS

# 3) aplicar as versões atrasadas (one-shot; arquivos são no-ops idempotentes)
mvn flyway:migrate -Dflyway.url=... -Dflyway.user=... -Dflyway.password=... \
                   -Dflyway.outOfOrder=true

# 4) validar e subir o app normalmente (out-of-order volta a false)
mvn flyway:validate -Dflyway.url=... -Dflyway.user=... -Dflyway.password=...
```

Notas de operação:
- Alternativa ao passo 3 sem flag: `spring.flyway.out-of-order: true` temporário
  no profile — **desligar depois** (one-shot, não deixar ligado por padrão).
- `CREATE INDEX` toma ShareLock (bloqueia writes) durante a criação — tabelas
  de ótica são pequenas (<100k linhas, janela <1s). Se algum legado for grande,
  criar `idx_produto_loja*`/`idx_os_*` **antes** com `CREATE INDEX CONCURRENTLY`
  (proibido dentro da txn do Flyway) e deixar os `IF NOT EXISTS` no-op-á-los.
- Verificação pós-aplicação:
  `SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;`
  → devem existir `1.1`, `3`, `4`, `5` com `success=t`.
  RLS: `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('produto','marca','categoria','pedido_venda','item_pedido');`

**Rollback (planejado):** remover os 4 arquivos de `db/migration/` +
`DELETE FROM flyway_schema_history WHERE version IN ('1.1','3','4','5');`
+ reverter os efeitos aditivos se desejado (índices `idx_produto_loja*`,
`idx_os_armacao/lente`, policy de `item_pedido`: `DROP POLICY loja_isolation ON
item_pedido; ALTER TABLE item_pedido NO FORCE/DISABLE ROW LEVEL SECURITY;`).
Não há perda de dado: nenhuma migration do draft apaga/reescreve linha.

## 6) Checklist de aceite (db-admin, com Postgres real)

- [ ] `flyway migrate` do zero conclui sem erro (V1→V1_1→V2→V3→V4→V5→V11→…→V36).
- [ ] `flyway validate` ok (`mvn flyway:validate`).
- [ ] `mvn test -Pintegration` verde (Testcontainers; `IsolamentoTenantTest`
      cobrindo produto/marca/categoria/pedido_venda/item_pedido — incluir caso
      de item de outra loja via parent-join).
- [ ] `mvn test -Punit-only` continua verde (contagem vigente: 232/232).
- [ ] Exercício do fail-closed: sem `SET LOCAL app.loja_id`, SELECT em
      `item_pedido` retorna 0 linhas para role sem BYPASSRLS.
- [ ] Adoção out-of-order em cópia do banco legado (staging) antes de produção.
- [ ] Decisões §3 registradas (ADR/`docs/decisions.md`) e `p1_blocker`
      removido de `state.json` pelo orquestrador (fora do meu escopo nesta task).

---

### Aviso
Os SQLs foram **inferidos das entidades JPA** (`EntidadeBase` +
`Produto`/`Marca`/`Categoria`/`PedidoVenda`/`Usuario` + enum `Perfil`) e do
consumo real das migrations/queries existentes (V2/V11/V13/V18/V21/V24/V25/V27/
V30/V31). Revisão estática completa (2026-10-13); **não foram executados**
contra nenhum Postgres. Tratar como especificação validável, não como migration
aprovada.
