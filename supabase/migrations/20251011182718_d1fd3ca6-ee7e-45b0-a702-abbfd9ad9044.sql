-- Force drop ALL overloads using CASCADE

-- Drop with CASCADE to remove all dependencies
DROP FUNCTION IF EXISTS public.stats_per_tipologia_effective CASCADE;
DROP FUNCTION IF EXISTS public.get_filtered_stats CASCADE;
DROP FUNCTION IF EXISTS public.get_residual_detail CASCADE;

-- Now recreate clean versions

-- Recreate get_filtered_stats v2.0
CREATE FUNCTION public.get_filtered_stats(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT ((date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year -1 days'::interval))::date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Recreate stats_per_tipologia_effective v2.0
CREATE FUNCTION public.stats_per_tipologia_effective(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT ((date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year -1 days'::interval))::date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT true,
  p_include_closed boolean DEFAULT true
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
AS $$
BEGIN
  RETURN QUERY
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
  filtered AS (
    SELECT * FROM base
    WHERE (
        (SELECT p_types FROM params) IS NULL 
        OR type_norm = ANY((SELECT p_types FROM params))
      )
      AND (
        (SELECT p_stats FROM params) IS NULL 
        OR status_norm = ANY((SELECT p_stats FROM params))
      )
      AND (p_include_closed = TRUE OR status_norm NOT IN ('interrotta','decaduta','estinta'))
      AND (p_taxpayer_search IS NULL OR taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  )
  SELECT
    f.type_label,
    COUNT(DISTINCT f.id)::bigint,
    COALESCE(SUM(f.total_amount_cents), 0)::bigint,
    COALESCE(SUM(f.paid_amount_cents), 0)::bigint,
    COALESCE(SUM(
      CASE 
        WHEN f.is_f24 = true AND f.status_norm = 'interrotta' AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0 
        ELSE f.residual_amount_cents 
      END
    ), 0)::bigint,
    COALESCE(SUM(
      CASE 
        WHEN f.is_f24 = true AND f.status_norm = 'interrotta' AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0 
        ELSE f.overdue_amount_cents 
      END
    ), 0)::bigint
  FROM filtered f
  GROUP BY f.type_label
  ORDER BY f.type_label;
END;
$$;

-- Recreate get_residual_detail v2.0
CREATE FUNCTION public.get_residual_detail(
  p_start_date date,
  p_end_date date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT true
)
RETURNS TABLE(
  id bigint,
  number text,
  type_label text,
  taxpayer_name text,
  status text,
  total_amount_cents bigint,
  paid_amount_cents bigint,
  residual_amount_cents bigint,
  overdue_amount_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
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
    SELECT DISTINCT ON (r.id)
      r.id,
      r.number,
      r.status,
      r.taxpayer_name,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm,
      (SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id) as total_amount_cents
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE r.id IN (SELECT rip.id FROM rateations_in_period rip)
  ),
  filtered AS (
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
  )
  SELECT
    f.id,
    f.number,
    f.type_label,
    f.taxpayer_name,
    f.status,
    f.total_amount_cents,
    f.paid_amount_cents,
    f.residual_amount_cents,
    f.overdue_amount_cents
  FROM filtered f
  ORDER BY f.residual_amount_cents DESC;
END;
$$;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_installments_rateation_due
  ON installments(rateation_id, due_date)
  WHERE due_date IS NOT NULL;

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';