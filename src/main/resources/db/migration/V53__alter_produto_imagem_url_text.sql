-- V53__alter_produto_imagem_url_text.sql — Suporte a Base64 e URLs longas em imagem_url de produto
ALTER TABLE produto ALTER COLUMN imagem_url TYPE TEXT;

COMMENT ON COLUMN produto.imagem_url IS 'Imagem/foto do produto em Base64 ou URL (TEXT para comportar Base64 sem truncar)';
