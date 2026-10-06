-- VisionBox M2 LGPD hardening: grau clinico cifrado como fonte primaria.
-- As colunas numericas permanecem apenas por compatibilidade de schema/API legado,
-- mas nao recebem novos dados pela aplicacao a partir desta versao.
UPDATE receita
SET od_esferico = NULL,
    od_cilindrico = NULL,
    od_eixo = NULL,
    od_adicao = NULL,
    od_dnp = NULL,
    oe_esferico = NULL,
    oe_cilindrico = NULL,
    oe_eixo = NULL,
    oe_adicao = NULL,
    oe_dnp = NULL
WHERE od_cipher IS NOT NULL
   OR oe_cipher IS NOT NULL;

COMMENT ON COLUMN receita.od_esferico IS 'LEGACY NULL em M2: grau clinico deve ficar em od_cipher AES-GCM';
COMMENT ON COLUMN receita.od_cilindrico IS 'LEGACY NULL em M2: grau clinico deve ficar em od_cipher AES-GCM';
COMMENT ON COLUMN receita.od_eixo IS 'LEGACY NULL em M2: grau clinico deve ficar em od_cipher AES-GCM';
COMMENT ON COLUMN receita.od_adicao IS 'LEGACY NULL em M2: grau clinico deve ficar em od_cipher AES-GCM';
COMMENT ON COLUMN receita.od_dnp IS 'LEGACY NULL em M2: grau clinico deve ficar em od_cipher AES-GCM';
COMMENT ON COLUMN receita.oe_esferico IS 'LEGACY NULL em M2: grau clinico deve ficar em oe_cipher AES-GCM';
COMMENT ON COLUMN receita.oe_cilindrico IS 'LEGACY NULL em M2: grau clinico deve ficar em oe_cipher AES-GCM';
COMMENT ON COLUMN receita.oe_eixo IS 'LEGACY NULL em M2: grau clinico deve ficar em oe_cipher AES-GCM';
COMMENT ON COLUMN receita.oe_adicao IS 'LEGACY NULL em M2: grau clinico deve ficar em oe_cipher AES-GCM';
COMMENT ON COLUMN receita.oe_dnp IS 'LEGACY NULL em M2: grau clinico deve ficar em oe_cipher AES-GCM';
