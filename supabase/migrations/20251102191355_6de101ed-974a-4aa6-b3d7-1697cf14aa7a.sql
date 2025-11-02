-- Fix get_kpi_due_by_type to use total_amount instead of installments sum
-- This aligns KPI cards with table totals (v_rateations_list_ui uses total_amount_cents)

CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
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
    -- FIXED: Use rateations.total_amount (matches table calculation)
    COALESCE(SUM(COALESCE(r.total_amount, 0) * 100), 0)::BIGINT AS amount_cents
  FROM rateations r
  WHERE r.owner_uid = auth.uid()
    AND r.status NOT IN ('decaduta', 'estinta')
    AND COALESCE(r.is_deleted, FALSE) = FALSE
  GROUP BY type_label;
END;
$$;

COMMENT ON FUNCTION public.get_kpi_due_by_type IS 'KPI breakdown: total due by type - uses total_amount to match v_rateations_list_ui calculation';