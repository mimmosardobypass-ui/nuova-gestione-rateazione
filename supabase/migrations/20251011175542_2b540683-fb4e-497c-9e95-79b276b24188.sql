-- ============================================================================
-- Fix errori post-migrazione: alias e ambiguità colonne
-- Root cause: 
--   1. type_norm usato nel WHERE ma definito nel SELECT (non disponibile)
--   2. Ambiguità su "id" nelle subquery
-- Soluzione: usare espressioni complete nel WHERE e alias espliciti
-- ============================================================================

-- 1) Correggi get_filtered_stats: usa UPPER(vtl.type_label) direttamente nel WHERE
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
  filtered_rateations AS (
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
      AND (
        (SELECT p_types FROM params) IS NULL 
        OR UPPER(vtl.type_label) = ANY((SELECT p_types FROM params))
      )
      AND (
        (SELECT p_stats FROM params) IS NULL 
        OR LOWER(r.status) = ANY((SELECT p_stats FROM params))
      )
      AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
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

-- 2) Correggi stats_per_tipologia_effective: stesso problema con alias
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
  src AS (
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
      -- includeClosed: esclude interrotta/estinta/decaduta se false
      AND (
        p_include_interrupted_estinte = TRUE 
        OR LOWER(r.status) NOT IN ('interrotta','estinta','decaduta')
      )
      -- stati (normalizzati case-insensitive)
      AND (
        (SELECT p_states_norm FROM params) IS NULL 
        OR LOWER(r.status) IN (SELECT unnest((SELECT p_states_norm FROM params)))
      )
      -- tipologie (normalizzate case-insensitive)
      AND (
        (SELECT p_types_norm FROM params) IS NULL 
        OR UPPER(vtl.type_label) IN (SELECT unnest((SELECT p_types_norm FROM params)))
      )
  )
  -- Aggregazione con regola F24↔PagoPA "effettiva"
  SELECT
    src.type_label AS tipo,
    COUNT(*)::bigint AS conteggio,
    COALESCE(SUM(src.total_amount * 100), 0)::bigint AS totale_cents,
    COALESCE(SUM(src.paid_amount_cents), 0)::bigint AS pagato_cents,
    COALESCE(SUM(
      CASE
        -- Esclude residuo F24 se interrotta per link PagoPA
        WHEN src.is_f24 = TRUE
             AND src.status_norm = 'interrotta'
             AND src.interruption_reason = 'F24_PAGOPA_LINK'
        THEN 0
        ELSE src.residual_amount_cents
      END
    ), 0)::bigint AS residuo_cents,
    COALESCE(SUM(
      CASE
        -- Esclude ritardo F24 se interrotta per link PagoPA
        WHEN src.is_f24 = TRUE
             AND src.status_norm = 'interrotta'
             AND src.interruption_reason = 'F24_PAGOPA_LINK'
        THEN 0
        ELSE src.overdue_amount_cents
      END
    ), 0)::bigint AS in_ritardo_cents
  FROM src
  GROUP BY src.type_label
  ORDER BY tipo;
$$;

-- 3) Correggi get_residual_detail: ambiguità su id
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
  )
  SELECT 
    r.id,
    r.number,
    r.taxpayer_name,
    vtl.type_label,
    r.status,
    r.created_at,
    r.residual_amount_cents
  FROM rateations r
  JOIN v_rateation_type_label vtl ON vtl.id = r.id
  WHERE 
    r.id IN (SELECT rip.id FROM rateations_in_period rip)
    AND r.residual_amount_cents > 0
    -- Normalizzazione tipologie
    AND (
      (SELECT p_types FROM params) IS NULL 
      OR UPPER(vtl.type_label) IN (SELECT unnest((SELECT p_types FROM params)))
    )
    -- Normalizzazione stati
    AND (
      (SELECT p_stats FROM params) IS NULL 
      OR LOWER(r.status) IN (SELECT unnest((SELECT p_stats FROM params)))
    )
    AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  ORDER BY r.residual_amount_cents DESC, r.created_at DESC;
END;
$function$;