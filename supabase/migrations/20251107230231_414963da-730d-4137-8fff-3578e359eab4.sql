-- Allinea v_rateation_type_label alla logica della RPC residual_evolution_by_type
-- per garantire coerenza tra importi aggregati e dettaglio rateazioni
-- NOTA: Mantengo l'ordine delle colonne per evitare errori di ALTER VIEW

CREATE OR REPLACE VIEW v_rateation_type_label AS
SELECT 
  r.id,
  r.owner_uid,
  r.type_id,
  rt.name AS tipo,
  CASE
    -- F24 ha priorità assoluta
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- Riam. Quater: rateazioni interrotte da una Quater (ALLINEATO ALLA RPC)
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    
    -- Rottamazione Quater: is_quater = TRUE
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    
    -- PagoPa: tipo contiene PAGOPA
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt2 
      WHERE rt2.id = r.type_id 
      AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    
    ELSE 'Altro'
  END AS type_label,
  EXISTS (
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id 
    AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) AS is_pagopa
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid();