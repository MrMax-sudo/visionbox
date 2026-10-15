-- V51__produto_imagem.sql — VisionBox — Suporte a Imagem/Foto de Produto no Catálogo
ALTER TABLE produto ADD COLUMN IF NOT EXISTS imagem_url TEXT;

COMMENT ON COLUMN produto.imagem_url IS 'Imagem/foto do produto em Base64 ou URL para exibição no catálogo e PDV';
