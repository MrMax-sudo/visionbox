# ADR-004 — Gateway Fiscal

- **Data:** 2026-09-05
- **Status:** Aceito
- **Contexto:** Emissão NFC-e 65 / NF-e 55 4.00 precisa homologação rápida MVP mas também contingência offline 100% em rede >20 lojas.
- **Decisão:** Interface `FiscalProvider {emitir,consultar,cancelar,inutilizar}` com impl `NuvemFiscalProvider/FocusProvider` para **MVP (2–5d homog)**, evoluindo para `SefazDiretoProvider` (SOAP `NFeAutorizacao4`, assinatura A1 local, `tpEmis 1/6/7/9`) na Fase 3 quando >5k NFC-e/mês ou exigência offline. `tributacao_regra(NCM+UF+CRT)` seed para 9003/9004, `sequencia_fiscal` com lock `FOR UPDATE` + `faixa_numeracao_offline` 500/PDV.
- **Validação:** 20 NFC-e homolog `ambiente=2` cobrindo 102/500/400, PIX, CEST, QR validado SEFAZ; teste contingência `tpEmis=9` airplane mode.

