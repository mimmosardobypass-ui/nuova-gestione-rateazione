-- Uniforma confronti array con = ANY() - Complete DROP and recreate

-- 1. Drop existing functions
DROP FUNCTION IF EXISTS public.stats_per_tipologia_effective(date, date, text[], text[], boolean);
DROP FUNCTION IF EXISTS public.get_residual_detail(date, date, text[], text[], text, boolean);

-- 2. Recreate stats_per_tipologia_effective with = ANY()
CREATE FUNCTION public.stats_per_tipologia_effective(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT ((date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year -1 days'::interval))::date,
  p_type_labels text[] DEFAULT NULL::text[],
  p_statuses text[] DEFAULT NULL::text[],
  p_include_closed boolean DEFAULT false
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
      public.norm_upper_arr(p_type_labels) AS p_types_norm,
      public.norm_lower_arr(
        CASE 
          WHEN p_statuses IS NULL AND p_include_closed THEN NULL
          WHEN p_statuses IS NULL AND NOT p_include_closed THEN ARRAY['attiva', 'in_ritardo', 'completata']
          WHEN p_include_closed THEN p_statuses
          ELSE array_cat(p_statuses, ARRAY['attiva', 'in_ritardo', 'completata'])
        END
      ) AS p_states_norm
  ),
  base AS (
    SELECT
      r.id,
      r.status,
      r.is_f24,
      r.interruption_reason,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm,
      i.due_date,
      (SELECT SUM(ix.amount_cents) FROM installments ix WHERE ix.rateation_id = r.id) AS total_amount_cents
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    JOIN installments i ON i.rateation_id = r.id
    WHERE r.owner_uid = auth.uid()
  ),
  src AS (
    SELECT DISTINCT ON (id)
      id, type_label, status, status_norm, type_norm,
      is_f24, interruption_reason,
      paid_amount_cents, residual_amount_cents, overdue_amount_cents, total_amount_cents
    FROM base
    WHERE due_date BETWEEN p_start_date AND p_end_date
      AND (
        (SELECT p_states_norm FROM params) IS NULL 
        OR status_norm = ANY((SELECT p_states_norm FROM params))
      )
      AND (
        (SELECT p_types_norm FROM params) IS NULL 
        OR type_norm = ANY((SELECT p_types_norm FROM params))
      )
  )
  SELECT
    s.type_label,
    COUNT(DISTINCT s.id)::bigint AS count,
    COALESCE(SUM(s.total_amount_cents), 0)::bigint AS total_amount_cents,
    COALESCE(SUM(s.paid_amount_cents), 0)::bigint AS paid_amount_cents,
    COALESCE(SUM(
      CASE 
        WHEN s.is_f24 = true 
             AND s.status_norm = 'interrotta' 
             AND s.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0 
        ELSE s.residual_amount_cents 
      END
    ), 0)::bigint AS residual_amount_cents,
    COALESCE(SUM(
      CASE 
        WHEN s.is_f24 = true 
             AND s.status_norm = 'interrotta' 
             AND s.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0 
        ELSE s.overdue_amount_cents 
      END
    ), 0)::bigint AS overdue_amount_cents
  FROM src s
  GROUP BY s.type_label;
END;
$function$;

-- 3. Recreate get_residual_detail with = ANY()
CREATE FUNCTION public.get_residual_detail(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT ((date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone) + '1 year -1 days'::interval))::date,
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
    SELECT DISTINCT ON (id)
      id, number, taxpayer_name, type_label, status, created_at, residual_amount_cents
    FROM base
    WHERE due_date BETWEEN p_start_date AND p_end_date
      AND (
        (SELECT p_types FROM params) IS NULL 
        OR type_norm = ANY((SELECT p_types FROM params))
      )
      AND (
        (SELECT p_stats FROM params) IS NULL 
        OR status_norm = ANY((SELECT p_stats FROM params))
      )
      AND (p_taxpayer_search IS NULL OR taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  )
  SELECT f.id, f.number, f.taxpayer_name, f.type_label, f.status, f.created_at, f.residual_amount_cents
  FROM filtered f
  WHERE f.residual_amount_cents > 0
  ORDER BY f.residual_amount_cents DESC;
END;
$function$;