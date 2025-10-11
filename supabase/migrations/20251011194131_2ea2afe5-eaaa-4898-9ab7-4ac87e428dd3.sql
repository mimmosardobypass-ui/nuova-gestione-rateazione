-- ============================================================================
-- EMERGENCY FIX: Ricrea tutte le funzioni RPC Stats da zero
-- Root cause: Le funzioni sono state droppate ma non ricreate correttamente
-- ============================================================================

-- 1. Drop con CASCADE per pulizia completa
DROP FUNCTION IF EXISTS public.norm_upper_arr(text[]) CASCADE;
DROP FUNCTION IF EXISTS public.norm_lower_arr(text[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_filtered_stats CASCADE;
DROP FUNCTION IF EXISTS public.get_residual_detail CASCADE;
DROP FUNCTION IF EXISTS public.stats_per_tipologia_effective CASCADE;

-- 2. Ricrea helper functions per normalizzazione
CREATE OR REPLACE FUNCTION public.norm_upper_arr(arr text[])
RETURNS text[] 
LANGUAGE sql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN arr IS NULL THEN NULL
    ELSE ARRAY(SELECT DISTINCT UPPER(TRIM(x)) FROM UNNEST(arr) x WHERE TRIM(x) != '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.norm_lower_arr(arr text[])
RETURNS text[] 
LANGUAGE sql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN arr IS NULL THEN NULL
    ELSE ARRAY(SELECT DISTINCT LOWER(TRIM(x)) FROM UNNEST(arr) x WHERE TRIM(x) != '')
  END;
$$;

-- 3. Ricrea get_filtered_stats
CREATE OR REPLACE FUNCTION public.get_filtered_stats(
  p_start_date date DEFAULT (date_trunc('year'::text, CURRENT_DATE))::date,
  p_end_date date DEFAULT (date_trunc('year'::text, CURRENT_DATE) + '1 year -1 days'::interval)::date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  p_types text[];
  p_stats text[];
BEGIN
  -- Normalizza parametri
  p_types := public.norm_upper_arr(p_type_labels);
  p_stats := public.norm_lower_arr(p_statuses);
  
  WITH rateations_in_period AS (
    SELECT DISTINCT r.id
    FROM rateations r
    JOIN installments i ON i.rateation_id = r.id
    WHERE (NOT p_owner_only OR r.owner_uid = auth.uid())
      AND i.due_date BETWEEN p_start_date AND p_end_date
  ),
  base AS (
    SELECT 
      r.id,
      r.status,
      r.taxpayer_name,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      r.is_f24,
      r.interruption_reason,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm,
      (SELECT COALESCE(SUM(i.amount_cents), 0) FROM installments i WHERE i.rateation_id = r.id) as total_amount_cents
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE r.id IN (SELECT rip.id FROM rateations_in_period rip)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_types IS NULL OR type_norm = ANY(p_types))
      AND (p_stats IS NULL OR status_norm = ANY(p_stats))
      AND (p_taxpayer_search IS NULL OR taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  ),
  agg_by_type AS (
    SELECT 
      type_label,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN is_f24 AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE residual_amount_cents END), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(CASE WHEN is_f24 AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE overdue_amount_cents END), 0)::bigint as overdue_amount_cents
    FROM filtered
    GROUP BY type_label
  ),
  agg_by_status AS (
    SELECT 
      COALESCE(status, 'unknown') as status,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN is_f24 AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE residual_amount_cents END), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(CASE WHEN is_f24 AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE overdue_amount_cents END), 0)::bigint as overdue_amount_cents
    FROM filtered
    GROUP BY status
  ),
  agg_by_taxpayer AS (
    SELECT 
      COALESCE(NULLIF(taxpayer_name, ''), 'Sconosciuto') as taxpayer_name,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN is_f24 AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE residual_amount_cents END), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(CASE WHEN is_f24 AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE overdue_amount_cents END), 0)::bigint as overdue_amount_cents
    FROM filtered
    GROUP BY taxpayer_name
    ORDER BY residual_amount_cents DESC
    LIMIT 50
  ),
  agg_cashflow AS (
    SELECT 
      DATE_TRUNC('month', i.due_date)::date as month,
      COUNT(DISTINCT i.id)::bigint as installments_count,
      COALESCE(SUM(i.amount_cents), 0)::bigint as due_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid THEN i.amount_cents ELSE 0 END), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN NOT i.is_paid THEN i.amount_cents ELSE 0 END), 0)::bigint as unpaid_amount_cents,
      COALESCE(SUM(CASE WHEN NOT i.is_paid AND i.due_date < CURRENT_DATE THEN i.amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
    FROM installments i
    WHERE i.rateation_id IN (SELECT f.id FROM filtered f)
      AND i.due_date IS NOT NULL
      AND i.due_date BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('month', i.due_date)
    ORDER BY month ASC
  )
  SELECT jsonb_build_object(
    'by_type', COALESCE((SELECT jsonb_agg(row_to_json(agg_by_type)) FROM agg_by_type), '[]'::jsonb),
    'by_status', COALESCE((SELECT jsonb_agg(row_to_json(agg_by_status)) FROM agg_by_status), '[]'::jsonb),
    'by_taxpayer', COALESCE((SELECT jsonb_agg(row_to_json(agg_by_taxpayer)) FROM agg_by_taxpayer), '[]'::jsonb),
    'cashflow', COALESCE((SELECT jsonb_agg(row_to_json(agg_cashflow)) FROM agg_cashflow), '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 4. Ricrea get_residual_detail
CREATE OR REPLACE FUNCTION public.get_residual_detail(
  p_start_date date,
  p_end_date date,
  p_type_labels text[],
  p_statuses text[],
  p_taxpayer_search text,
  p_owner_only boolean
)
RETURNS TABLE(
  id bigint,
  tipo text,
  taxpayer_name text,
  total_due_cents bigint,
  paid_cents bigint,
  residual_cents bigint,
  overdue_cents bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_types text[];
  p_stats text[];
BEGIN
  p_types := public.norm_upper_arr(p_type_labels);
  p_stats := public.norm_lower_arr(p_statuses);
  
  RETURN QUERY
  WITH base AS (
    SELECT
      r.id as r_id,
      r.status,
      r.taxpayer_name,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm,
      i.due_date
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    JOIN installments i ON i.rateation_id = r.id
    WHERE (NOT p_owner_only OR r.owner_uid = auth.uid())
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE due_date BETWEEN p_start_date AND p_end_date
      AND (p_types IS NULL OR type_norm = ANY(p_types))
      AND (p_stats IS NULL OR status_norm = ANY(p_stats))
      AND (p_taxpayer_search IS NULL OR COALESCE(taxpayer_name,'') ILIKE '%' || p_taxpayer_search || '%')
  )
  SELECT DISTINCT ON (f.r_id)
    f.r_id as id,
    f.type_label AS tipo,
    f.taxpayer_name,
    (SELECT COALESCE(SUM(i.amount_cents), 0) FROM installments i WHERE i.rateation_id = f.r_id)::bigint AS total_due_cents,
    f.paid_amount_cents::bigint AS paid_cents,
    f.residual_amount_cents::bigint AS residual_cents,
    f.overdue_amount_cents::bigint AS overdue_cents,
    f.status
  FROM filtered f
  ORDER BY f.r_id DESC, f.due_date DESC;
END;
$$;

-- 5. Ricrea stats_per_tipologia_effective
CREATE OR REPLACE FUNCTION public.stats_per_tipologia_effective(
  p_start_date date,
  p_end_date date,
  p_statuses text[],
  p_type_labels text[],
  p_include_closed boolean
)
RETURNS TABLE(
  type_label text,
  count bigint,
  total_amount_cents bigint,
  paid_amount_cents bigint,
  residual_amount_cents bigint,
  overdue_amount_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_types text[];
  p_stats text[];
BEGIN
  p_types := public.norm_upper_arr(p_type_labels);
  p_stats := public.norm_lower_arr(p_statuses);
  
  RETURN QUERY
  WITH base AS (
    SELECT
      r.id,
      r.status,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      r.total_amount_cents,
      r.is_f24,
      r.interruption_reason,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm,
      i.due_date
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    JOIN installments i ON i.rateation_id = r.id
    WHERE r.owner_uid = auth.uid()
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE due_date BETWEEN p_start_date AND p_end_date
      AND (p_types IS NULL OR type_norm = ANY(p_types))
      AND (p_stats IS NULL OR status_norm = ANY(p_stats))
      AND (p_include_closed OR status_norm NOT IN ('interrotta','estinta'))
  )
  SELECT
    f.type_label,
    COUNT(DISTINCT f.id)::bigint AS count,
    COALESCE(SUM(f.total_amount_cents),0)::bigint AS total_amount_cents,
    COALESCE(SUM(f.paid_amount_cents),0)::bigint AS paid_amount_cents,
    COALESCE(SUM(CASE WHEN f.is_f24 AND f.status_norm = 'interrotta' AND f.interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE f.residual_amount_cents END),0)::bigint AS residual_amount_cents,
    COALESCE(SUM(CASE WHEN f.is_f24 AND f.status_norm = 'interrotta' AND f.interruption_reason = 'F24_PAGOPA_LINK' THEN 0 ELSE f.overdue_amount_cents END),0)::bigint AS overdue_amount_cents
  FROM filtered f
  GROUP BY f.type_label
  ORDER BY f.type_label;
END;
$$;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION public.norm_upper_arr(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.norm_lower_arr(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_residual_detail TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_per_tipologia_effective TO authenticated;

-- 7. Add comments
COMMENT ON FUNCTION public.get_filtered_stats IS 'v4.0 - Ricreata da zero con = ANY()';
COMMENT ON FUNCTION public.get_residual_detail IS 'v4.0 - Ricreata da zero con = ANY()';
COMMENT ON FUNCTION public.stats_per_tipologia_effective IS 'v4.0 - Ricreata da zero con = ANY()';

-- 8. Force PostgREST reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';