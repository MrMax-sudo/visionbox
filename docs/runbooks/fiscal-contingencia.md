# Runbook — Fiscal Contingência

1. Detecta `cStat 999/timeout 3x` → Redis `sefaz:status:SP=OFFLINE TTL 10m`.
2. PDV `GET /sefaz/status` → entra `tpEmis=9 FS-DA`, consome `faixa_numeracao_offline` IndexedDB.
3. Assina A1 cache, grava `documento_fiscal PENDENTE_CONTINGENCIA + outbox_fiscal`.
4. Imprime DANFE tarja `PENDENTE DE AUTORIZAÇÃO`.
5. `@RabbitListener fiscal.contingencia` backoff 1m*2 até 1h, sucesso → `AUTORIZADO`, `204` já existe → `AUTORIZADO`, falha → DLQ 24h.
6. Job `PENDENTE_CONTINGENCIA AND data_entrada < now-20h` alerta gerente.

## SefazDiretoProvider — incremento seguro

- `MockFiscalProvider` continua sendo o provider padrao em `dev`, `test` e `default`.
- `SefazDiretoProvider` so e carregado com profile `sefaz-direto`.
- Estado atual: modo contrato. Valida documento, `ambiente=1|2`, `tpEmis=1|6|7|9`, XML NF-e/NFC-e 4.00 e presenca de assinatura XMLDSig, mas nao chama SOAP real.
- Retornos locais: `codigoStatus=000` para falha de validacao antes da SEFAZ; `codigoStatus=998` para contrato valido com envio/consulta/cancelamento/inutilizacao SOAP ainda pendente de homologacao.
- Homologacao real pendente: certificado A1 por loja, assinatura XMLDSig completa, endpoints UF/autorizadores, `NFeAutorizacao4`, `NFeRetAutorizacao4`, `NFeConsultaProtocolo4`, eventos, QR Code NFC-e e bateria homolog ambiente 2 prevista na ADR-004.
