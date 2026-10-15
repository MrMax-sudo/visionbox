-- V50__loja_logo_base64.sql — VisionBox — Armazenamento persistente de Logo da Loja
-- Permite armazenar imagens de logo diretamente no banco de dados (TEXT base64)
-- para que documentos como DANFE, Recibo 80mm e Orçamento A4 possam renderizar
-- o logotipo real da ótica.

ALTER TABLE loja ALTER COLUMN logo_url TYPE TEXT;
ALTER TABLE loja ADD COLUMN IF NOT EXISTS logo_base64 TEXT;

COMMENT ON COLUMN loja.logo_base64 IS 'Logotipo da loja codificado em Base64 persistido no banco de dados para renderização em DANFE, Recibos e Orçamentos';
