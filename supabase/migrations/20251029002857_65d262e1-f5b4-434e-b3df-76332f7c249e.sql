-- Fix v_rateation_type_label per gestire correttamente Quater e Riam.Quater
-- 
-- Il problema era che cercava '%ROTTAMAZIONE%QUATER%' ma il tipo si chiama solo 'Quater'
-- e cercava '%RIAM%QUATER%' ma il tipo si chiama 'Riam.Quater' (con punto in mezzo)

CREATE OR REPLACE VIEW v_rateation_type_label AS
SELECT 
  r.id,
  r.owner_uid,
  r.type_id,
  rt.name AS tipo,
  CASE
    -- 1. PagoPA (check su nome - più specifico)
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%' THEN 'PagoPA'
    
    -- 2. F24 (check su flag booleano o nome)
    WHEN r.is_f24 = TRUE OR UPPER(COALESCE(rt.name, '')) LIKE '%F24%' 
    THEN 'F24'
    
    -- 3. Riammissione Quater (nome esatto o pattern)
    --    Gestisce: 'Riam.Quater', 'Riam. Quater', 'RIAMMISSIONE QUATER', etc.
    WHEN rt.name IN ('Riam.Quater', 'Riam. Quater')
         OR UPPER(COALESCE(rt.name, '')) LIKE '%RIAMMISSION%' 
         OR (UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%' AND r.is_quater = TRUE)
    THEN 'Riam. Quater'
    
    -- 4. Rottamazione Quater (nome esatto o flag is_quater)
    --    Gestisce: 'Quater', 'ROTTAMAZIONE QUATER', etc.
    WHEN rt.name = 'Quater'
         OR r.is_quater = TRUE
         OR UPPER(COALESCE(rt.name, '')) LIKE '%ROTTAMAZ%'
    THEN 'Rottamazione Quater'
    
    -- 5. Default
    ELSE 'Altro'
  END AS type_label,
  
  EXISTS (
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id 
    AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) AS is_pagopa
  
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE COALESCE(r.is_deleted, false) = false;