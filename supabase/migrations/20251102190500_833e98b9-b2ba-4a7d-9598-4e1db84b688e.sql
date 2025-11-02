-- Drop old views that don't work with auth.uid()
DROP VIEW IF EXISTS v_kpi_due_by_type CASCADE;
DROP VIEW IF EXISTS v_kpi_paid_by_type CASCADE;
DROP VIEW IF EXISTS v_kpi_residual_by_type CASCADE;
DROP VIEW IF EXISTS v_kpi_overdue_by_type CASCADE;

-- 1. Function: KPI Due By Type (replaces view)
CREATE OR REPLACE FUNCTION get_kpi_due_by_type()
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
    COALESCE(SUM(i.amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  LEFT JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND r.status NOT IN ('decaduta', 'estinta')
    AND COALESCE(r.is_deleted, FALSE) = FALSE
  GROUP BY type_label;
END;
$$;

-- 2. Function: KPI Paid By Type (replaces view)
CREATE OR REPLACE FUNCTION get_kpi_paid_by_type()
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
    AND r.status NOT IN ('decaduta', 'estinta')
    AND COALESCE(r.is_deleted, FALSE) = FALSE
  GROUP BY type_label;
END;
$$;

-- 3. Function: KPI Residual By Type (replaces view)
CREATE OR REPLACE FUNCTION get_kpi_residual_by_type()
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
    AND r.status = 'attiva'
    AND COALESCE(r.is_deleted, FALSE) = FALSE
  GROUP BY type_label;
END;
$$;

-- 4. Function: KPI Overdue By Type (replaces view)
CREATE OR REPLACE FUNCTION get_kpi_overdue_by_type()
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
    COALESCE(SUM(r.overdue_amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  WHERE r.owner_uid = auth.uid()
    AND r.status = 'attiva'
    AND COALESCE(r.is_deleted, FALSE) = FALSE
  GROUP BY type_label;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_kpi_due_by_type() TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpi_paid_by_type() TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpi_residual_by_type() TO authenticated;
GRANT EXECUTE ON FUNCTION get_kpi_overdue_by_type() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_kpi_due_by_type IS 'KPI breakdown: total due by type (SECURITY DEFINER for auth.uid() context)';
COMMENT ON FUNCTION get_kpi_paid_by_type IS 'KPI breakdown: total paid by type (SECURITY DEFINER for auth.uid() context)';
COMMENT ON FUNCTION get_kpi_residual_by_type IS 'KPI breakdown: residual by type (SECURITY DEFINER for auth.uid() context)';
COMMENT ON FUNCTION get_kpi_overdue_by_type IS 'KPI breakdown: overdue by type (SECURITY DEFINER for auth.uid() context)';