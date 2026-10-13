# Correção — CHECK `usuario.perfil` sem `DESENVOLVEDOR` (bug latente da V13)

> **Status: RESOLVIDO na cadeia oficial pela V27** (verificado 2026-10-13).
> Este documento registra o problema, o fix já existente e o SQL de emergência
> para bancos presos na janela V13..V26. **Não cria migration em `db/migration/`**
> (ordem da tarefa P1 — o draft permanece em `docs/p1-migrations-draft/`).

## 1) O bug

- `V13__usuario_auth.sql:18` cria `usuario.perfil` com CHECK de **7 valores**:
  `'ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO'`.
- O enum Java `Perfil` (`modules/usuario/domain/Perfil.java`) tem **8 valores** —
  inclui `DESENVOLVEDOR` (Fase 3: Painel Desenvolvedor, `docs/PROGRESS.md` Fase 3).
- Sintoma em banco com V13 aplicada e V27 ausente: `INSERT/UPDATE usuario` com
  `perfil='DESENVOLVEDOR'` → erro SQL `23514` (check constraint violation).
  O bug é **latente**: só aparece ao promover o primeiro usuário DESENVOLVEDOR.

## 2) Fix já existente na cadeia oficial (V27)

`V27__empresa_config.sql:20-23` **já corrige** o problema, idempotentemente:

```sql
-- RBAC Fase 3: permite perfil DESENVOLVEDOR (Painel Dev / diagnóstico)
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_perfil_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_perfil_check
    CHECK (perfil IN ('ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO','DESENVOLVEDOR'));
```

- O CHECK da V13 é anônimo → o PG auto-nomeia `usuario_perfil_check`
  (padrão `{tabela}_{coluna}_check`) → o `DROP ... IF EXISTS` da V27 acerta o nome.
- **Todo banco com V27 aplicada está imune.** Nenhuma ação adicional é necessária.

## 3) Consistência com o draft (V1_1)

O `V1_1__legacy_foundation.sql` cria `usuario` com o CHECK de **8 valores** (sem
nome → mesmo auto-nome `usuario_perfil_check`). Três caminhos convergem:

| Caminho | Estado intermediário | Estado final |
|---|---|---|
| Banco limpo (V1_1 → V13 → V27) | V1_1 cria com 8 valores; V13 `CREATE TABLE IF NOT EXISTS` = no-op | V27 dropa/recria 8 valores — idêntico |
| Banco limpo sem draft (hipotético) | V13 criaria com 7 valores | V27 corrige na posição 27 |
| Banco legado (out-of-order) | V13 já aplicada; V27 corrige | 8 valores |

## 4) SQL de emergência — banco preso na janela V13..V26

Somente para snapshots restaurados **entre V13 e V26** (sem V27). Aplicar
manualmente em janela de manutenção (DDL curto, AccessExclusiveLock apenas em
catálogo — validação de tabela existente é verificação por linha no UPDATE/INSERT
futuro; não reescreve a tabela):

```sql
BEGIN;

-- 0) Pré-verificação: nenhum usuário já usa valor fora dos 7 (sanidade)
SELECT count(*) AS invalidos
FROM usuario
WHERE perfil NOT IN ('ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO');
-- deve retornar 0; se > 0, investigar antes de prosseguir

-- 1) Mesmo comando da V27 (idempotente, mesmo nome de constraint)
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_perfil_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_perfil_check
    CHECK (perfil IN ('ADMIN','GERENTE','VENDEDOR','OTICO','TECNICO','FINANCEIRO','LABORATORIO','DESENVOLVEDOR'));

COMMIT;
```

## 5) Verificação pós-correção

```sql
-- Deve listar uma única constraint com os 8 valores (inclui DESENVOLVEDOR)
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'usuario'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%perfil%';

-- Smoke test transacional (não persiste):
BEGIN;
SET LOCAL app.loja_id = '00000000-0000-0000-0000-000000000001';
INSERT INTO usuario (loja_id, nome, email, senha_hash, perfil)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'smoke-test-dev',
        'smoke@invalid.local', 'x', 'DESENVOLVEDOR');
ROLLBACK;
-- ausência de erro 23514 = CHECK ok
```

## 6) Por que documento e não migration nova

- A correção **já existe** na cadeia oficial (V27) — criar migration redundante
  em `db/migration/` usaria um número de versão à toa e duplicaria o estado.
- A V1_1 do draft já nasce com o estado final (8 valores), eliminando a janela
  vulnerável em bancos limpos.
- O SQL §4 fica registrado aqui para DR: restauração de backup antigo pode
  ressuscitar a janela V13..V26 sem que a V27 seja reaplicável por checksum
  (backup point-in-time anterior à V27). Nesse caso aplicar §4 e seguir.
