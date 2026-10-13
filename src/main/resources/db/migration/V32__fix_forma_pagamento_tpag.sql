-- V32__fix_forma_pagamento_tpag.sql — VisionBox
-- Garante que todas as formas de pagamento possuam sua respectiva tag fiscal interna (tPag) da SEFAZ

UPDATE forma_pagamento 
SET t_pag_nfce = CASE tipo 
    WHEN 'DINHEIRO' THEN '01' 
    WHEN 'PIX' THEN '17' 
    WHEN 'DEBITO' THEN '04' 
    WHEN 'CREDITO' THEN '03' 
    WHEN 'CREDIARIO' THEN '05' 
    ELSE '99' 
END 
WHERE t_pag_nfce IS NULL OR t_pag_nfce = '';
