-- ============================================================================
-- Fix definitivo: stats_per_tipologia_effective usa v_rateation_type_label
-- Root cause: mappatura manuale divergeva dalla vista canonica
-- Soluzione: uniformare a v_rateation_type_label per coerenza con altre RPC
-- ============================================================================

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
  WITH src AS (
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
    WHERE r.owner_uid = auth.uid()
      AND r.created_at::date BETWEEN p_date_from AND p_date_to
      -- includeClosed: esclude interrotta/estinta/decaduta se false
      AND (
        p_include_interrupted_estinte = TRUE 
        OR LOWER(r.status) NOT IN ('interrotta','estinta','decaduta')
      )
      -- stati (normalizzati case-insensitive)
      AND (
        p_states IS NULL 
        OR LOWER(r.status) IN (SELECT LOWER(TRIM(s)) FROM UNNEST(p_states) s)
      )
      -- tipologie (normalizzate case-insensitive)
      AND (
        p_types IS NULL 
        OR UPPER(vtl.type_label) IN (SELECT UPPER(TRIM(x)) FROM UNNEST(p_types) x)
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

COMMENT ON FUNCTION stats_per_tipologia_effective IS 
'Stats per tipologia usando v_rateation_type_label (PAGOPA prioritario su F24). Esclude residui/ritardi F24↔PagoPA linkate.';