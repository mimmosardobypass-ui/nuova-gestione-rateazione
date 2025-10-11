-- Drop corrupted function
DROP FUNCTION IF EXISTS public.get_filtered_stats(DATE, DATE, TEXT[], TEXT[], TEXT, BOOLEAN, BOOLEAN);

-- Recreate get_filtered_stats with correct aggregation structure
CREATE OR REPLACE FUNCTION public.get_filtered_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_taxpayer_search TEXT DEFAULT NULL,
  p_owner_only BOOLEAN DEFAULT FALSE,
  p_include_closed BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_by_type jsonb := '[]'::jsonb;
  v_by_status jsonb := '[]'::jsonb;
  v_by_taxpayer jsonb := '[]'::jsonb;
  v_cashflow jsonb := '[]'::jsonb;
  v_kpi_residual bigint := 0;
  v_kpi_paid bigint := 0;
  v_kpi_overdue bigint := 0;
BEGIN
  -- Base CTE with all filters
  WITH base AS (
    SELECT
      r.id,
      r.taxpayer_name,
      r.status,
      COALESCE(v.type_label, 'Altro') as type_label,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      (r.paid_amount_cents + r.residual_amount_cents) as total_amount_cents
    FROM rateations r
    LEFT JOIN v_rateation_type_label v ON v.id = r.id
    WHERE r.owner_uid = auth.uid()
      AND (p_start_date IS NULL OR EXISTS (
        SELECT 1 FROM installments i 
        WHERE i.rateation_id = r.id AND i.due_date >= p_start_date
      ))
      AND (p_end_date IS NULL OR EXISTS (
        SELECT 1 FROM installments i 
        WHERE i.rateation_id = r.id AND i.due_date <= p_end_date
      ))
      AND (p_types IS NULL OR COALESCE(v.type_label, 'Altro') = ANY(p_types))
      AND (p_statuses IS NULL OR LOWER(r.status) = ANY(p_statuses))
      AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
      AND (p_include_closed OR LOWER(r.status) NOT IN ('completata', 'decaduta', 'interrotta'))
  ),
  
  -- Pre-aggregate by type
  agg_by_type AS (
    SELECT
      type_label,
      COUNT(*) as count,
      SUM(total_amount_cents) as total_amount_cents,
      SUM(paid_amount_cents) as paid_amount_cents,
      SUM(residual_amount_cents) as residual_amount_cents,
      SUM(overdue_amount_cents) as overdue_amount_cents
    FROM base
    GROUP BY type_label
  ),
  
  -- Pre-aggregate by status
  agg_by_status AS (
    SELECT
      status,
      COUNT(*) as count,
      SUM(total_amount_cents) as total_amount_cents
    FROM base
    GROUP BY status
  ),
  
  -- Pre-aggregate by taxpayer (top 10)
  agg_by_taxpayer AS (
    SELECT
      taxpayer_name,
      COUNT(*) as count,
      SUM(total_amount_cents) as total_amount_cents,
      SUM(residual_amount_cents) as residual_amount_cents
    FROM base
    GROUP BY taxpayer_name
    ORDER BY SUM(total_amount_cents) DESC
    LIMIT 10
  ),
  
  -- Global KPIs
  kpis AS (
    SELECT
      COALESCE(SUM(residual_amount_cents), 0) as residual,
      COALESCE(SUM(paid_amount_cents), 0) as paid,
      COALESCE(SUM(overdue_amount_cents), 0) as overdue
    FROM base
  )
  
  -- Build JSON aggregates from pre-aggregated CTEs
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type_label', type_label,
        'count', count,
        'total_amount_cents', total_amount_cents,
        'paid_amount_cents', paid_amount_cents,
        'residual_amount_cents', residual_amount_cents,
        'overdue_amount_cents', overdue_amount_cents
      ))
      FROM agg_by_type
    ), '[]'::jsonb),
    
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'status', status,
        'count', count,
        'total_amount_cents', total_amount_cents
      ))
      FROM agg_by_status
    ), '[]'::jsonb),
    
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'taxpayer_name', taxpayer_name,
        'count', count,
        'total_amount_cents', total_amount_cents,
        'residual_amount_cents', residual_amount_cents
      ))
      FROM agg_by_taxpayer
    ), '[]'::jsonb),
    
    (SELECT residual FROM kpis),
    (SELECT paid FROM kpis),
    (SELECT overdue FROM kpis)
    
  INTO v_by_type, v_by_status, v_by_taxpayer, v_kpi_residual, v_kpi_paid, v_kpi_overdue;

  -- Return complete response
  RETURN jsonb_build_object(
    'by_type', v_by_type,
    'by_status', v_by_status,
    'by_taxpayer', v_by_taxpayer,
    'cashflow', v_cashflow,
    'kpi_residual_amount_cents', v_kpi_residual,
    'kpi_paid_amount_cents', v_kpi_paid,
    'kpi_overdue_amount_cents', v_kpi_overdue
  );
END;
$$;