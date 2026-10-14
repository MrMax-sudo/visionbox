-- V48__loja_serie_numeracao_fiscal.sql — série e número inicial configuráveis por loja.
-- O FiscalService gerava o número com ThreadLocalRandom(1..999999), o que em produção
-- arrisca duplicidade de (CNPJ, modelo, série, número) — a SEFAZ rejeita a nota duplicada.
-- Série e número inicial passam a viver na loja (editados no Painel Fiscal) e a emissão
-- usa sempre o maior número já usado na mesma série + 1, igual ao ultimo_numero_nfce do OUTBOX ERP.

ALTER TABLE loja ADD COLUMN IF NOT EXISTS fiscal_serie_nfce VARCHAR(3);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS fiscal_serie_nfe VARCHAR(3);
ALTER TABLE loja ADD COLUMN IF NOT EXISTS fiscal_numero_inicial_nfce INTEGER;
ALTER TABLE loja ADD COLUMN IF NOT EXISTS fiscal_numero_inicial_nfe INTEGER;

COMMENT ON COLUMN loja.fiscal_serie_nfce IS
    'Série da NFC-e (modelo 65) usada na emissão — 1 a 3 dígitos, configurável por loja';
COMMENT ON COLUMN loja.fiscal_serie_nfe IS
    'Série da NF-e (modelo 55) usada na emissão — 1 a 3 dígitos, configurável por loja';
COMMENT ON COLUMN loja.fiscal_numero_inicial_nfce IS
    'Primeiro número da série da NFC-e quando a série ainda não tem documentos no ambiente';
COMMENT ON COLUMN loja.fiscal_numero_inicial_nfe IS
    'Primeiro número da série da NF-e quando a série ainda não tem documentos no ambiente';
