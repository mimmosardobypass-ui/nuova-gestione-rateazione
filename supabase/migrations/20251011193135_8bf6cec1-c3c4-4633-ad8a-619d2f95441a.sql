-- Drop all conflicting overloads
DROP FUNCTION IF EXISTS public.stats_per_tipologia_effective(date, date, text[], text[], boolean) CASCADE;
DROP FUNCTION IF EXISTS public.stats_per_tipologia_effective(date, date, text[], text[], text, boolean, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.get_filtered_stats(date, date, text[], text[], text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.get_residual_detail(date, date, text[], text[], text, boolean) CASCADE;

-- Create single stats_per_tipologia_effective with correct signature
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH params AS (
    SELECT
      public.norm_upper_arr(p_type_labels) AS p_types,
      public.norm_lower_arr(p_statuses) AS p_stats
  ),
  base AS (
    SELECT
      r.*,
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
    WHERE due_date::date BETWEEN p_start_date AND p_end_date
      AND ( (SELECT p_types FROM params) IS NULL
            OR type_norm = ANY((SELECT p_types FROM params)) )
      AND ( (SELECT p_stats FROM params) IS NULL
            OR status_norm = ANY((SELECT p_stats FROM params)) )
      AND ( p_include_closed = TRUE
            OR status_norm NOT IN ('interrotta','estinta') )
  )
  SELECT
    f.type_label,
    COUNT(DISTINCT f.id)::bigint AS count,
    COALESCE(SUM(f.total_amount_cents),0)::bigint AS total_amount_cents,
    COALESCE(SUM(f.paid_amount_cents),0)::bigint AS paid_amount_cents,
    COALESCE(SUM(
      CASE 
        WHEN f.is_f24 = true AND f.status_norm = 'interrotta' AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0 
        ELSE f.residual_amount_cents 
      END
    ),0)::bigint AS residual_amount_cents,
    COALESCE(SUM(
      CASE 
        WHEN f.is_f24 = true AND f.status_norm = 'interrotta' AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0 
        ELSE f.overdue_amount_cents 
      END
    ),0)::bigint AS overdue_amount_cents
  FROM filtered f
  GROUP BY f.type_label
  ORDER BY f.type_label;
END;
$function$;

-- Recreate get_filtered_stats with aligned signature
CREATE OR REPLACE FUNCTION public.get_filtered_stats(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT ((date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year -1 days'::interval))::date,
  p_type_labels text[] DEFAULT NULL::text[],
  p_statuses text[] DEFAULT NULL::text[],
  p_taxpayer_search text DEFAULT NULL::text,
  p_owner_only boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH params AS (
    SELECT
      public.norm_upper_arr(p_type_labels) AS p_types,
      public.norm_lower_arr(p_statuses) AS p_stats
  ),
  rateations_in_period AS (
    SELECT DISTINCT r.id
    FROM rateations r
    JOIN installments i ON i.rateation_id = r.id
    WHERE (NOT p_owner_only OR r.owner_uid = auth.uid())
      AND i.due_date BETWEEN p_start_date AND p_end_date
  ),
  base AS (
    SELECT 
      r.id,
      r.owner_uid,
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
      (SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id) as total_amount_cents
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE r.id IN (SELECT rip.id FROM rateations_in_period rip)
  ),
  filtered_rateations AS (
    SELECT * FROM base
    WHERE (
        (SELECT p_types FROM params) IS NULL 
        OR type_norm = ANY((SELECT p_types FROM params))
      )
      AND (
        (SELECT p_stats FROM params) IS NULL 
        OR status_norm = ANY((SELECT p_stats FROM params))
      )
      AND (p_taxpayer_search IS NULL OR taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  ),
  agg_by_type AS (
    SELECT 
      type_label,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE overdue_amount_cents 
        END
      ), 0)::bigint as overdue_amount_cents
    FROM filtered_rateations
    GROUP BY type_label
  ),
  agg_by_status AS (
    SELECT 
      COALESCE(status, 'unknown') as status,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE overdue_amount_cents 
        END
      ), 0)::bigint as overdue_amount_cents
    FROM filtered_rateations
    GROUP BY status
  ),
  agg_by_taxpayer AS (
    SELECT 
      COALESCE(NULLIF(taxpayer_name, ''), 'Sconosciuto') as taxpayer_name,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true AND status_norm = 'interrotta' AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE overdue_amount_cents 
        END
      ), 0)::bigint as overdue_amount_cents
    FROM filtered_rateations
    GROUP BY taxpayer_name
    ORDER BY residual_amount_cents DESC
    LIMIT 50
  ),
  agg_cashflow AS (
    SELECT 
      DATE_TRUNC('month', i.due_date)::date as month,
      COUNT(DISTINCT i.id)::bigint as installments_count,
      COALESCE(SUM(i.amount_cents), 0)::bigint as due_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid = true THEN i.amount_cents ELSE 0 END), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount_cents ELSE 0 END), 0)::bigint as unpaid_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid = false AND i.due_date < CURRENT_DATE THEN i.amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
    FROM installments i
    WHERE i.rateation_id IN (SELECT fr.id FROM filtered_rateations fr)
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
$function$;

-- Recreate get_residual_detail with aligned output columns
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH params AS (
    SELECT
      public.norm_upper_arr(p_type_labels) AS p_types,
      public.norm_lower_arr(p_statuses) AS p_stats
  ),
  base AS (
    SELECT
      r.*,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm,
      i.due_date
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    JOIN installments i ON i.rateation_id = r.id
    WHERE (NOT p_owner_only OR r.owner_uid = auth.uid())
  ),
  src AS (
    SELECT *
    FROM base
    WHERE due_date::date BETWEEN p_start_date AND p_end_date
      AND ( (SELECT p_types FROM params) IS NULL
            OR type_norm = ANY((SELECT p_types FROM params)) )
      AND ( (SELECT p_stats FROM params) IS NULL
            OR status_norm = ANY((SELECT p_stats FROM params)) )
      AND ( p_taxpayer_search IS NULL
            OR COALESCE(taxpayer_name,'') ILIKE '%' || p_taxpayer_search || '%' )
  )
  SELECT DISTINCT ON (src.id)
    src.id,
    src.type_label AS tipo,
    src.taxpayer_name,
    (SELECT COALESCE(SUM(i.amount_cents), 0) FROM installments i WHERE i.rateation_id = src.id) AS total_due_cents,
    src.paid_amount_cents AS paid_cents,
    src.residual_amount_cents AS residual_cents,
    src.overdue_amount_cents AS overdue_cents,
    src.status
  FROM src
  ORDER BY src.id DESC, src.due_date DESC;
END;
$function$;

-- Add performance index
CREATE INDEX IF NOT EXISTS idx_installments_rateation_due
  ON installments(rateation_id, due_date)
  WHERE due_date IS NOT NULL;

-- Add versioning comments
COMMENT ON FUNCTION public.get_filtered_stats(date, date, text[], text[], text, boolean) IS 'v3.1 - Aligned signatures, ANY pattern';
COMMENT ON FUNCTION public.stats_per_tipologia_effective(date, date, text[], text[], boolean) IS 'v3.1 - Single overload, correct param order';
COMMENT ON FUNCTION public.get_residual_detail(date, date, text[], text[], text, boolean) IS 'v3.1 - Aligned output columns';

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';