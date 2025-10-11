-- Fix: Correggi get_filtered_stats (confronto array) e get_residual_detail (ambiguità id)

-- 1. Fix get_filtered_stats - Assicura = ANY() ovunque
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
          WHEN is_f24 = true 
               AND status_norm = 'interrotta' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true 
               AND status_norm = 'interrotta' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
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
          WHEN is_f24 = true 
               AND status_norm = 'interrotta' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true 
               AND status_norm = 'interrotta' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
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
          WHEN is_f24 = true 
               AND status_norm = 'interrotta' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true 
               AND status_norm = 'interrotta' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
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

-- 2. Fix get_residual_detail - Risolvi ambiguità id
CREATE OR REPLACE FUNCTION public.get_residual_detail(
  p_start_date date,
  p_end_date date,
  p_type_labels text[] DEFAULT NULL::text[],
  p_statuses text[] DEFAULT NULL::text[],
  p_taxpayer_search text DEFAULT NULL::text,
  p_owner_only boolean DEFAULT true
)
RETURNS TABLE(
  id bigint,
  number text,
  taxpayer_name text,
  type_label text,
  status text,
  created_at timestamp with time zone,
  residual_amount_cents bigint
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
      r.id,
      r.number,
      r.taxpayer_name,
      r.status,
      r.created_at,
      r.residual_amount_cents,
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
    SELECT DISTINCT ON (base.id)
      base.id,
      base.number,
      base.taxpayer_name,
      base.type_label,
      base.status,
      base.created_at,
      base.residual_amount_cents
    FROM base
    WHERE base.due_date BETWEEN p_start_date AND p_end_date
      AND (
        (SELECT p_types FROM params) IS NULL 
        OR base.type_norm = ANY((SELECT p_types FROM params))
      )
      AND (
        (SELECT p_stats FROM params) IS NULL 
        OR base.status_norm = ANY((SELECT p_stats FROM params))
      )
      AND (p_taxpayer_search IS NULL OR base.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  )
  SELECT f.id, f.number, f.taxpayer_name, f.type_label, f.status, f.created_at, f.residual_amount_cents
  FROM filtered f
  WHERE f.residual_amount_cents > 0
  ORDER BY f.residual_amount_cents DESC;
END;
$function$;