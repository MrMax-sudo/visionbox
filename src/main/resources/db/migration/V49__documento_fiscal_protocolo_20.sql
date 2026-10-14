-- V49__documento_fiscal_protocolo_20.sql — protocolo da SEFAZ em producao tem 17 digitos.
-- O tipo TProt do XSD limita o protocolo a 15 digitos, mas a SEFAZ-SP em PRODUCAO devolve
-- 17 (ex.: 13526007062662399 da NFC-e serie 90 numero 1). Gravar em varchar(15) derrubava a
-- emissao com DataIntegrityViolationException (409) DEPOIS de a nota ja estar autorizada.
-- Folga ate 20 para o dado real, que e o que vale sobre o leiaute.

ALTER TABLE documento_fiscal ALTER COLUMN protocolo TYPE VARCHAR(20);

COMMENT ON COLUMN documento_fiscal.protocolo IS
    'Protocolo de autorizacao da SEFAZ — ate 20 posicoes: a SEFAZ-SP em producao devolve 17, acima do TProt(15) do XSD';
