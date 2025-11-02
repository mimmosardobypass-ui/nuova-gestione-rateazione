-- Fix get_kpi_paid_by_type and get_kpi_residual_by_type to match UI filter "active_with_pending_decayed"
-- Problem: paid includes completata/interrotta, residual excludes F24 decadute
-- Solution: Both use same filter as get_kpi_due_by_type (active + F24 decadute with residuo > 0)

CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE (
  type_label TEXT,
  amount_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN r.is_f24 = TRUE THEN 'F24'
      WHEN r.interrupted_by_rateation_id IS NOT NULL 
        AND EXISTS (SELECT 1 FROM rateations rq WHERE rq.id = r.interrupted_by_rateation_id AND rq.is_quater = TRUE)
        THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE 
        AND EXISTS (SELECT 1 FROM rateation_types rt WHERE rt.id = r.type_id AND rt.name = 'Riam.Quater')
        THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE 
        AND EXISTS (SELECT 1 FROM rateation_types rt WHERE rt.id = r.type_id AND rt.name = 'Rottamazione Quater')
        THEN 'Rottamazione Quater'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN EXISTS (SELECT 1 FROM rateation_types rt WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%')
        THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(r.paid_amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  WHERE r.owner_uid = auth.uid()
    AND COALESCE(r.is_deleted, FALSE) = FALSE
    AND (
      -- CASO A: Rateazioni ATTIVE (residuo > 0, escluse completate/interrotte/estinte)
      (
        COALESCE(r.residual_amount_cents, 0) > 0
        AND UPPER(COALESCE(r.status, '')) NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA')
      )
      OR
      -- CASO B: F24 DECADUTE non agganciate (con residuo > 0)
      (
        r.is_f24 = TRUE
        AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
        AND COALESCE(r.residual_amount_cents, 0) > 0
      )
    )
  GROUP BY type_label;
END;
$$;

COMMENT ON FUNCTION public.get_kpi_paid_by_type IS 'KPI breakdown: total paid by type - matches UI filter "active_with_pending_decayed"';

-- Fix get_kpi_residual_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE (
  type_label TEXT,
  amount_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN r.is_f24 = TRUE THEN 'F24'
      WHEN r.interrupted_by_rateation_id IS NOT NULL 
        AND EXISTS (SELECT 1 FROM rateations rq WHERE rq.id = r.interrupted_by_rateation_id AND rq.is_quater = TRUE)
        THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE 
        AND EXISTS (SELECT 1 FROM rateation_types rt WHERE rt.id = r.type_id AND rt.name = 'Riam.Quater')
        THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE 
        AND EXISTS (SELECT 1 FROM rateation_types rt WHERE rt.id = r.type_id AND rt.name = 'Rottamazione Quater')
        THEN 'Rottamazione Quater'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN EXISTS (SELECT 1 FROM rateation_types rt WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%')
        THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(r.residual_amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  WHERE r.owner_uid = auth.uid()
    AND COALESCE(r.is_deleted, FALSE) = FALSE
    AND (
      -- CASO A: Rateazioni ATTIVE (residuo > 0, escluse completate/interrotte/estinte)
      (
        COALESCE(r.residual_amount_cents, 0) > 0
        AND UPPER(COALESCE(r.status, '')) NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA')
      )
      OR
      -- CASO B: F24 DECADUTE non agganciate (con residuo > 0)
      (
        r.is_f24 = TRUE
        AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
        AND COALESCE(r.residual_amount_cents, 0) > 0
      )
    )
  GROUP BY type_label;
END;
$$;

COMMENT ON FUNCTION public.get_kpi_residual_by_type IS 'KPI breakdown: total residual by type - matches UI filter "active_with_pending_decayed"';