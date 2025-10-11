-- Fix: invertire ordine CASE per dare priorità a PAGOPA rispetto a is_f24
-- Root cause: rateazioni PagoPA con is_f24=TRUE venivano classificate come 'F24'

CREATE OR REPLACE VIEW v_rateation_type_label AS
SELECT 
  r.id,
  r.owner_uid,
  r.type_id,
  rt.name AS tipo,
  EXISTS (
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id 
    AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) AS is_pagopa,
  CASE
    -- 1) PAGOPA prima (più specifico)
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt2 
      WHERE rt2.id = r.type_id 
      AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PAGOPA'
    
    -- 2) poi F24 (meno specifico)
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- 3) invariato
    WHEN r.is_quater = TRUE AND COALESCE(rt.name, '') ILIKE '%riam%' THEN 'Riammissione Quater'
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    ELSE COALESCE(NULLIF(rt.name, ''), 'ALTRO')
  END AS type_label
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid();

COMMENT ON VIEW v_rateation_type_label IS 'Canonical labels: F24, PAGOPA, Rottamazione Quater, Riammissione Quater, ALTRO';

-- Verifica immediata: conteggi per tipo
SELECT type_label, COUNT(*) 
FROM v_rateation_type_label
GROUP BY type_label
ORDER BY type_label;