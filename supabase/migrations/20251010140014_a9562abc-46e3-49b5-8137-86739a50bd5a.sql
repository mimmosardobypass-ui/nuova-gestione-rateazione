-- ============================================================================
-- FASE 1: Statistiche Avanzate - Vista e RPC per "Per Tipologia" Effective
-- ============================================================================
-- Implementa la regola F24↔PagoPA: F24 interrotte per link PagoPA 
-- contribuiscono €0 a residuo/ritardo

-- 1. Vista aggregata per tipologia (single source of truth)
CREATE OR REPLACE VIEW public.v_stats_per_tipologia_effective AS
SELECT
  CASE
    WHEN r.is_f24 THEN 'F24'
    WHEN UPPER(rt.name) LIKE '%PAGOPA%' THEN 'PagoPA'
    WHEN UPPER(rt.name) LIKE '%ROTTAMAZIONE%QUATER%' THEN 'Rottamazione Quater'
    WHEN UPPER(rt.name) ~ '(RIAM|RIAMM).*(QUATER)' THEN 'Riam. Quater'
    ELSE 'Altro'
  END AS tipo,
  COUNT(*)::bigint                              AS conteggio,
  COALESCE(SUM(r.total_amount * 100)::bigint, 0) AS totale_cents,
  COALESCE(SUM(r.paid_amount_cents), 0)         AS pagato_cents,
  COALESCE(SUM(
    CASE
      WHEN r.is_f24 = true 
           AND r.status = 'INTERROTTA' 
           AND r.interruption_reason = 'F24_PAGOPA_LINK'
        THEN 0
      ELSE r.residual_amount_cents
    END
  ), 0)                                          AS residuo_cents,
  COALESCE(SUM(
    CASE
      WHEN r.is_f24 = true 
           AND r.status = 'INTERROTTA' 
           AND r.interruption_reason = 'F24_PAGOPA_LINK'
        THEN 0
      ELSE r.overdue_amount_cents
    END
  ), 0)                                          AS in_ritardo_cents
FROM public.rateations r
JOIN public.rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid()
GROUP BY 1;

COMMENT ON VIEW public.v_stats_per_tipologia_effective IS
'Aggregazione per tipologia che include PagoPA ed esclude i residui/ritardi delle F24 interrotte per link PagoPA';

-- 2. RPC parametrica per applicare i filtri UI
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
  WITH base AS (
    SELECT r.*, rt.name AS type_name
    FROM public.rateations r
    JOIN public.rateation_types rt ON rt.id = r.type_id
    WHERE r.owner_uid = auth.uid()
      AND r.created_at::date BETWEEN p_date_from AND p_date_to
      AND (
        p_include_interrupted_estinte = true
        OR r.status NOT IN ('INTERROTTA','ESTINTA','decaduta')
      )
      AND (
        p_states IS NULL 
        OR array_length(p_states, 1) IS NULL 
        OR r.status = ANY(p_states)
      )
  ),
  mapped AS (
    SELECT
      CASE
        WHEN b.is_f24 THEN 'F24'
        WHEN UPPER(b.type_name) LIKE '%PAGOPA%' THEN 'PagoPA'
        WHEN UPPER(b.type_name) LIKE '%ROTTAMAZIONE%QUATER%' THEN 'Rottamazione Quater'
        WHEN UPPER(b.type_name) ~ '(RIAM|RIAMM).*(QUATER)' THEN 'Riam. Quater'
        ELSE 'Altro'
      END AS tipo,
      b.*
    FROM base b
  ),
  filtered AS (
    SELECT * FROM mapped
    WHERE p_types IS NULL 
       OR array_length(p_types, 1) IS NULL 
       OR tipo = ANY(p_types)
  )
  SELECT
    f.tipo,
    COUNT(*)::bigint AS conteggio,
    COALESCE(SUM(f.total_amount * 100)::bigint, 0) AS totale_cents,
    COALESCE(SUM(f.paid_amount_cents), 0) AS pagato_cents,
    COALESCE(SUM(
      CASE
        WHEN f.is_f24 = true 
             AND f.status = 'INTERROTTA' 
             AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0
        ELSE f.residual_amount_cents
      END
    ), 0) AS residuo_cents,
    COALESCE(SUM(
      CASE
        WHEN f.is_f24 = true 
             AND f.status = 'INTERROTTA' 
             AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0
        ELSE f.overdue_amount_cents
      END
    ), 0) AS in_ritardo_cents
  FROM filtered f
  GROUP BY f.tipo
  ORDER BY f.tipo;
$$;

REVOKE ALL ON FUNCTION public.stats_per_tipologia_effective FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stats_per_tipologia_effective TO authenticated;

COMMENT ON FUNCTION public.stats_per_tipologia_effective IS
'RPC parametrica per statistiche per tipologia con regola F24↔PagoPA applicata';

-- 3. Aggiornare RPC get_filtered_stats esistente per applicare regola F24↔PagoPA
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
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH filtered_rateations AS (
    SELECT 
      r.id,
      r.owner_uid,
      r.status,
      r.taxpayer_name,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      r.created_at,
      r.is_f24,
      r.interruption_reason,
      vtl.type_label,
      (SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id) as total_amount_cents
    FROM rateations r
    LEFT JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE 
      (NOT p_owner_only OR r.owner_uid = auth.uid())
      AND r.created_at::date BETWEEN p_start_date AND p_end_date
      AND (p_type_labels IS NULL OR vtl.type_label = ANY(p_type_labels))
      AND (p_statuses IS NULL OR r.status = ANY(p_statuses))
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
               AND status = 'INTERROTTA' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true 
               AND status = 'INTERROTTA' 
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
               AND status = 'INTERROTTA' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true 
               AND status = 'INTERROTTA' 
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
               AND status = 'INTERROTTA' 
               AND interruption_reason = 'F24_PAGOPA_LINK' 
            THEN 0 
          ELSE residual_amount_cents 
        END
      ), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(
        CASE 
          WHEN is_f24 = true 
               AND status = 'INTERROTTA' 
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
    WHERE i.rateation_id IN (SELECT id FROM filtered_rateations)
      AND i.due_date IS NOT NULL
      AND i.due_date::date BETWEEN p_start_date AND p_end_date
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