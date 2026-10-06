# ADR-001 — Multi-tenant `loja_id` shared database

- **Data:** 2026-09-05
- **Status:** Aceito
- **Contexto:** Rede ótica 5–80 lojas precisa BI consolidado sem custo N schemas; spec §3 exige `loja_id` em todas as tabelas. Alternativa seria schema por tenant.
- **Decisão:** Shared database, shared schema com `loja_id UUID NOT NULL` + Hibernate `@TenantId` + `CurrentTenantIdentifierResolver(TenantContext)` + `TenantFilter` após JWT + RLS `FORCE` como segunda barreira. Todas as queries `findByIdAndLojaId`. Repositórios sem `loja_id` são bug bloqueante.
- **Consequências:** Operação simples (1 Flyway, 1 backup), BI cross-tenant trivial, índices compostos `(loja_id,...)`, PgBouncer transaction pooling. Migração para schema por tenant (Fase 4) via `MultiTenantConnectionProvider(SET search_path)` sem rewrite se manter `loja_id`.
- **Validação:** `IsolamentoTenantTest` Testcontainers prova `lojaA não vê lojaB` em repo, query nativa, Redis prefix, S3 path.
- **Referências:** `visionbox-especificacao.md:75`, `arquivo.md` §9

