-- V45__loja_flowbox_certificado_id.sql — referência ao certificado A1 no Flowbox.
-- O motor fiscal passa a aceitar `certificadoId` na emissão (alternativa ao PFX inline),
-- então a loja guarda apenas a referência: o arquivo PKCS12 e a senha continuam cifrados
-- dentro do Flowbox e nunca trafegam pela API do VisionBox (R9/ADR-004).

ALTER TABLE loja ADD COLUMN IF NOT EXISTS flowbox_certificado_id BIGINT;

COMMENT ON COLUMN loja.flowbox_certificado_id IS
    'Id do certificado A1 em /api/v1/certificados do Flowbox — nunca o PFX (R9/ADR-004)';
