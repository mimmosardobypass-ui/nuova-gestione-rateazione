-- ============================================================================
-- FIX COMPLETO: Collegamenti PagoPA con Residuo/Risparmio a 0
-- ============================================================================
-- Root Cause: amount_cents NULL su 787 installments → snapshot salvati come 0
-- Soluzione: Sync amount_cents + trigger INSERT + reset snapshot + ricalcolo
-- ============================================================================

-- STEP 1: Sync amount_cents per tutti gli installments con NULL
-- ============================================================================
-- Risolve il problema alla radice per 787 righe
UPDATE installments
SET amount_cents = (amount * 100)::bigint
WHERE amount_cents IS NULL 
  AND amount IS NOT NULL;

-- STEP 2: Aggiungi trigger INSERT per prevenire futuri NULL
-- ============================================================================
-- Crea funzione per INSERT
CREATE OR REPLACE FUNCTION sync_amount_cents_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount IS NOT NULL AND NEW.amount_cents IS NULL THEN
    NEW.amount_cents := (NEW.amount * 100)::bigint;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aggiungi trigger su INSERT
DROP TRIGGER IF EXISTS sync_amount_cents_trigger_insert ON installments;
CREATE TRIGGER sync_amount_cents_trigger_insert
  BEFORE INSERT ON installments
  FOR EACH ROW 
  EXECUTE FUNCTION sync_amount_cents_insert();

-- STEP 3: Reset snapshot 0 → NULL sui link
-- ============================================================================
-- Forza il fallback nella view per i link con snapshot = 0
UPDATE riam_quater_links
SET pagopa_residual_at_link_cents = NULL,
    rq_total_at_link_cents = NULL
WHERE pagopa_residual_at_link_cents = 0 
   OR rq_total_at_link_cents = 0;

-- STEP 4: Ricalcola snapshot corretti con amount_cents valorizzati
-- ============================================================================
UPDATE riam_quater_links l
SET 
  pagopa_residual_at_link_cents = (
    SELECT COALESCE(SUM(i.amount_cents), 0)
    FROM installments i
    WHERE i.rateation_id = l.pagopa_id 
      AND i.is_paid = FALSE
  ),
  rq_total_at_link_cents = (
    SELECT COALESCE(SUM(i.amount_cents), 0)
    FROM installments i
    WHERE i.rateation_id = l.riam_quater_id
  )
WHERE pagopa_residual_at_link_cents IS NULL 
   OR rq_total_at_link_cents IS NULL;

-- ============================================================================
-- VERIFICA POST-FIX (esegui manualmente per controllo)
-- ============================================================================
-- 1. Verifica amount_cents NULL (deve restituire 0)
-- SELECT COUNT(*) FROM installments WHERE amount_cents IS NULL;

-- 2. Verifica PagoPA N.34 residuo
-- SELECT residuo_pagopa_at_link_cents / 100.0 as residuo_eur,
--        risparmio_at_link_cents / 100.0 as risparmio_eur
-- FROM v_pagopa_linked_rq
-- WHERE pagopa_number = 'N.34 PagoPa';

-- 3. Verifica nessun snapshot 0 falso
-- SELECT COUNT(*) FROM riam_quater_links
-- WHERE (pagopa_residual_at_link_cents = 0 OR rq_total_at_link_cents = 0)
--   AND unlinked_at IS NULL;