-- ============================================================================
-- Fix v_kpi_rateations_effective: applica filtro "debito reale"
-- Filtra solo rateazioni ATTIVE + F24 DECADUTE con residuo > 0
-- ============================================================================
CREATE OR REPLACE VIEW public.v_kpi_rateations_effective AS
SELECT
  COALESCE(SUM(r.residual_amount_cents), 0) AS effective_residual_amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    -- CASO A: Rateazioni ATTIVE (esclude completate, interrotte, estinte, decadute)
    (r.residual_amount_cents > 0 
     AND UPPER(COALESCE(r.status, '')) NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    -- CASO B: F24 DECADUTE in attesa di cartella (residuo > 0)
    (r.is_f24 = TRUE 
     AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' 
     AND r.residual_amount_cents > 0)
  );

-- ============================================================================
-- Fix v_kpi_rateations_overdue_effective: applica filtro "debito reale"
-- Filtra solo rateazioni ATTIVE + F24 DECADUTE con residuo > 0
-- ============================================================================
CREATE OR REPLACE VIEW public.v_kpi_rateations_overdue_effective AS
SELECT
  COALESCE(SUM(r.overdue_amount_cents), 0) AS effective_overdue_amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    -- CASO A: Rateazioni ATTIVE (esclude completate, interrotte, estinte, decadute)
    (r.residual_amount_cents > 0 
     AND UPPER(COALESCE(r.status, '')) NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    -- CASO B: F24 DECADUTE in attesa di cartella (residuo > 0)
    (r.is_f24 = TRUE 
     AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' 
     AND r.overdue_amount_cents > 0)
  );