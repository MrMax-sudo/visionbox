-- O motivo de rejeicao vem do Flowbox/SEFAZ como corpo HTTP completo e estourava o
-- varchar(500) original: SQLState 22001 -> DataIntegrityViolationException -> HTTP 409,
-- mascarando a rejeicao real (ex.: "Remote host terminated the handshake").
ALTER TABLE documento_fiscal ALTER COLUMN motivo TYPE TEXT;
