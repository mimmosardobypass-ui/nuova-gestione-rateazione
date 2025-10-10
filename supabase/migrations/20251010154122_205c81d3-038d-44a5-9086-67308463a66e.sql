-- Fix definitivo per stats_per_tipologia_effective
-- PRIORITÀ CORRETTA: type_name PRIMA di is_f24
-- 1. Gestione 'Quater' standalone → 'Rottamazione Quater'
-- 2. PagoPA con is_f24=true → mappato come PAGOPA (non F24)
-- 3. Case-insensitive status matching

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
        OR UPPER(r.status) NOT IN ('INTERROTTA','ESTINTA','DECADUTA')
      )
      AND (
        p_states IS NULL 
        OR array_length(p_states, 1) IS NULL 
        OR UPPER(r.status) = ANY(SELECT UPPER(unnest(p_states)))
      )
  ),
  mapped AS (
    SELECT
      CASE
        -- 1. PRIMA: controlla type_name esplicito per PagoPA
        WHEN UPPER(b.type_name) LIKE '%PAGOPA%' THEN 'PAGOPA'
        
        -- 2. Quater standalone (senza "Rottamazione" o "Riam")
        WHEN UPPER(b.type_name) LIKE '%QUATER%' 
             AND UPPER(b.type_name) NOT LIKE '%ROTTAMAZIONE%'
             AND UPPER(REPLACE(b.type_name, '.', ' ')) !~ '(RIAM|RIAMM)' 
          THEN 'Rottamazione Quater'
        
        -- 3. Rottamazione Quater esplicito
        WHEN UPPER(b.type_name) LIKE '%ROTTAMAZIONE%' AND UPPER(b.type_name) LIKE '%QUATER%' 
          THEN 'Rottamazione Quater'
        
        -- 4. Riammissione Quater (gestisce 'Riam.Quater' e varianti)
        WHEN UPPER(REPLACE(b.type_name, '.', ' ')) ~ '(RIAM|RIAMM).*(QUATER)' 
          THEN 'Riammissione Quater'
        
        -- 5. SOLO ALLA FINE: F24 come fallback per is_f24=true
        WHEN b.is_f24 THEN 'F24'
        
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
             AND UPPER(f.status) = 'INTERROTTA'
             AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0
        ELSE f.residual_amount_cents
      END
    ), 0) AS residuo_cents,
    COALESCE(SUM(
      CASE
        WHEN f.is_f24 = true 
             AND UPPER(f.status) = 'INTERROTTA'
             AND f.interruption_reason = 'F24_PAGOPA_LINK' 
          THEN 0
        ELSE f.overdue_amount_cents
      END
    ), 0) AS in_ritardo_cents
  FROM filtered f
  GROUP BY f.tipo
  ORDER BY f.tipo;
$$;