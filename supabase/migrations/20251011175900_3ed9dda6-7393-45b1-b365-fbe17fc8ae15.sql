-- ============================================================================
-- Fix alias in WHERE clause: split CTE for alias calculation vs filtering
-- Root cause: aliases like type_norm used in WHERE of same SELECT
-- Solution: base CTE calculates aliases, filtered CTE applies WHERE
-- ============================================================================

-- 1) get_filtered_stats: ritorna KPI scalari
CREATE OR REPLACE FUNCTION public.get_filtered_stats(
  p_start_date date DEFAULT (date_trunc('year'::text, CURRENT_DATE))::date,
  p_end_date   date DEFAULT (date_trunc('year'::text, CURRENT_DATE) + '1 year -1 days'::interval)::date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH params AS (
    SELECT
      public.norm_upper_arr(p_type_labels) AS p_types,
      public.norm_lower_arr(p_statuses) AS p_stats
  ),
  -- Rateazioni con almeno 1 rata nel periodo
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

-- 2) stats_per_tipologia_effective: statistiche per tipologia
CREATE OR REPLACE FUNCTION public.stats_per_tipologia_effective(
  p_date_from date,
  p_date_to   date,
  p_states    text[],
  p_types     text[],
  p_include_interrupted_estinte boolean DEFAULT false
)
RETURNS TABLE(
  tipo text,
  conteggio bigint,
  totale_cents bigint,
  pagato_cents bigint,
  residuo_cents bigint,
  in_ritardo_cents bigint
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      public.norm_upper_arr(p_types) AS p_types_norm,
      public.norm_lower_arr(p_states) AS p_states_norm
  ),
  -- Rateazioni con almeno 1 rata nel periodo
  rateations_in_period AS (
    SELECT DISTINCT r.id
    FROM rateations r
    JOIN installments i ON i.rateation_id = r.id
    WHERE r.owner_uid = auth.uid()
      AND i.due_date BETWEEN p_date_from AND p_date_to
  ),
  base AS (
    SELECT
      r.id,
      r.owner_uid,
      r.is_f24,
      r.status,
      r.interruption_reason,
      r.total_amount,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      vtl.type_label,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE r.id IN (SELECT rip.id FROM rateations_in_period rip)
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (
        p_include_interrupted_estinte = TRUE 
        OR status_norm NOT IN ('interrotta','estinta','decaduta')
      )
      AND (
        (SELECT p_states_norm FROM params) IS NULL 
        OR status_norm IN (SELECT unnest((SELECT p_states_norm FROM params)))
      )
      AND (
        (SELECT p_types_norm FROM params) IS NULL 
        OR type_norm IN (SELECT unnest((SELECT p_types_norm FROM params)))
      )
  )
  -- Aggregazione con regola F24↔PagoPA "effettiva"
  SELECT
    filtered.type_label AS tipo,
    COUNT(*)::bigint AS conteggio,
    COALESCE(SUM(filtered.total_amount * 100), 0)::bigint AS totale_cents,
    COALESCE(SUM(filtered.paid_amount_cents), 0)::bigint AS pagato_cents,
    COALESCE(SUM(
      CASE
        WHEN filtered.is_f24 = TRUE
             AND filtered.status_norm = 'interrotta'
             AND filtered.interruption_reason = 'F24_PAGOPA_LINK'
        THEN 0
        ELSE filtered.residual_amount_cents
      END
    ), 0)::bigint AS residuo_cents,
    COALESCE(SUM(
      CASE
        WHEN filtered.is_f24 = TRUE
             AND filtered.status_norm = 'interrotta'
             AND filtered.interruption_reason = 'F24_PAGOPA_LINK'
        THEN 0
        ELSE filtered.overdue_amount_cents
      END
    ), 0)::bigint AS in_ritardo_cents
  FROM filtered
  GROUP BY filtered.type_label
  ORDER BY tipo;
$$;

-- 3) get_residual_detail: dettaglio residui per rateazione
CREATE OR REPLACE FUNCTION public.get_residual_detail(
  p_start_date date DEFAULT (date_trunc('year'::text, CURRENT_DATE))::date,
  p_end_date   date DEFAULT (date_trunc('year'::text, CURRENT_DATE) + '1 year -1 days'::interval)::date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
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
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  WITH params AS (
    SELECT
      public.norm_upper_arr(p_type_labels) AS p_types,
      public.norm_lower_arr(p_statuses) AS p_stats
  ),
  -- Rateazioni con almeno 1 rata nel periodo
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
      r.number,
      r.taxpayer_name,
      vtl.type_label,
      r.status,
      r.created_at,
      r.residual_amount_cents,
      UPPER(vtl.type_label) AS type_norm,
      LOWER(r.status) AS status_norm
    FROM rateations r
    JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE r.id IN (SELECT rip.id FROM rateations_in_period rip)
      AND r.residual_amount_cents > 0
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (
        (SELECT p_types FROM params) IS NULL 
        OR type_norm IN (SELECT unnest((SELECT p_types FROM params)))
      )
      AND (
        (SELECT p_stats FROM params) IS NULL 
        OR status_norm IN (SELECT unnest((SELECT p_stats FROM params)))
      )
      AND (p_taxpayer_search IS NULL OR taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  )
  SELECT 
    filtered.id,
    filtered.number,
    filtered.taxpayer_name,
    filtered.type_label,
    filtered.status,
    filtered.created_at,
    filtered.residual_amount_cents
  FROM filtered
  ORDER BY filtered.residual_amount_cents DESC, filtered.created_at DESC;
END;
$function$;

-- 4) Verifica indice per performance
CREATE INDEX IF NOT EXISTS idx_installments_rateation_due
  ON installments(rateation_id, due_date)
  WHERE due_date IS NOT NULL;