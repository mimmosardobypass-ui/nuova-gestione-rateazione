-- Fix v_rateation_type_label canonical labels
-- Risolve: mismatch "Riam. Quater" vs "Riammissione Quater" nelle RPC

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
    WHEN r.is_f24 = TRUE THEN 'F24'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt2 
      WHERE rt2.id = r.type_id 
      AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PAGOPA'
    WHEN r.is_quater = TRUE AND COALESCE(rt.name, '') ILIKE '%riam%' THEN 'Riammissione Quater'
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    ELSE COALESCE(NULLIF(rt.name, ''), 'ALTRO')
  END AS type_label
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid();

COMMENT ON VIEW v_rateation_type_label IS 'Canonical DB labels: F24, PAGOPA, Rottamazione Quater, Riammissione Quater, ALTRO';