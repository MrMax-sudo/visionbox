-- V47__loja_cadastro_fiscal.sql — cadastro fiscal do emitente por loja (R9/ADR-004).
-- O emitente era remontado com valores fixos em FlowboxFiscalProvider (IE 123456789110,
-- CSC 0123456789, CSC Id 000001, município 3550308, CRT 1) e a SEFAZ devolvia
-- cStat 209 — "Rejeição: IE do emitente inválida". Os dados passam a viver na própria loja
-- e são editados no Painel Fiscal (Configurações → Módulo Fiscal), sem deploy.

ALTER TABLE loja ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS csc VARCHAR(64);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS csc_id VARCHAR(6);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS codigo_municipio VARCHAR(7);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS crt VARCHAR(1);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS fiscal_ambiente VARCHAR(20);

COMMENT ON COLUMN loja.inscricao_estadual IS
    'Inscrição Estadual real do emitente na SEFAZ da UF — obrigatória; divergência gera cStat 209';
COMMENT ON COLUMN loja.csc IS
    'CSC (Código de Segurança do Contribuinte) da NFC-e emitido no portal da NF-e da UF';
COMMENT ON COLUMN loja.csc_id IS
    'Id do CSC no portal da NF-e — sai sem zero à esquerda no XML (TSerie/TNF impedem zero à esquerda)';
COMMENT ON COLUMN loja.codigo_municipio IS
    'Código IBGE de 7 dígitos do município de emissão (cMunFG)';
COMMENT ON COLUMN loja.crt IS
    'Código de Regime Tributário: 1 Simples Nacional, 2 Lucro Presumido, 3 Lucro Real';
COMMENT ON COLUMN loja.fiscal_ambiente IS
    'Ambiente da SEFAZ usado na emissão: HOMOLOGACAO ou PRODUCAO';
