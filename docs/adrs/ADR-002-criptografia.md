# ADR-002 — Criptografia CPF e GrauOlho

- **Data:** 2026-09-05
- **Status:** Aceito
- **Contexto:** `Cliente.cpf` e `Receita.GrauOlho` são dado pessoal/sensível saúde (LGPD art.11). Spec §7 previa `pgcrypto OU coluna criptografada` indefinido; CVE-2026-2005 pgcrypto RCE.
- **Decisão:** **Converter JPA AES-256-GCM app-side + `cpf_hash HMAC-SHA256(pepper,cpfNorm) UNIQUE(loja_id,cpf_hash)`** vence pgcrypto. Formato cipher `[1B ver][12B nonce][cipher][16B tag]`, KEK em Vault/KMS, DEK por loja derivada `HKDF(KEK+loja_id)`, `od_cipher/oe_cipher bytea` JSON. Busca por hash, decrypt só do hit. Display mascarado `***.456.789-**` para VENDEDOR. Rotação via `RewrapJob` recripta sem downtime; filas offline SQLCipher.
- **Rejeitado:** `pgcrypto pgp_sym_encrypt` puro — chave visível em `pg_stat_statements`, backup exposto, CVE blast radius DB.
- **Validação:** `CpfConverterTest` roundtrip + `cpf_hash` lookup + `RewrapJobTest`.

