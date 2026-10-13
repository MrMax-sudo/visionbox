-- V43__cliente_uf_varchar.sql — correção de contrato entidade × schema
-- A V1/V2 criou cliente.uf como CHAR(2); a entidade Cliente mapeia String
-- length=2 → Hibernate espera VARCHAR(2) e o validate falhava no boot
-- ("wrong column type ... found [bpchar], but expecting [varchar(2)]",
-- validado em Postgres real 2026-10-13). O schema legado (Hibernate) usava
-- varchar(2) — este ALTER alinha o Flyway ao legado. CHAR(2)→VARCHAR(2) é
-- cast trivial (valores preenchidos com space-pad passam a trimmed).

ALTER TABLE cliente ALTER COLUMN uf TYPE VARCHAR(2);
