-- =====================================================
-- RPC: preview_link_f24_to_pagopa
-- Calcola preview collegamento F24→PagoPA con fallback robusti
-- =====================================================

CREATE OR REPLACE FUNCTION public.preview_link_f24_to_pagopa(
  p_f24_id bigint,
  p_pagopa_id bigint
)
RETURNS TABLE(
  f24_residual_cents bigint,
  pagopa_total_cents bigint,
  delta_cents bigint
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH f24_calc AS (
    SELECT
      -- Fallback cascade per residuo F24:
      -- 1. residual_at_decadence_cents (snapshot al momento decadenza - più accurato)
      -- 2. residual_amount_cents (cache calcolata dai trigger)
      -- 3. (total_amount * 100 - paid_amount_cents) (ricalcolo diretto)
      -- 4. 0 (fallback finale)
      COALESCE(
        r.residual_at_decadence_cents,
        r.residual_amount_cents,
        ((r.total_amount * 100)::bigint - COALESCE(r.paid_amount_cents, 0)),
        0
      )::bigint AS f24_residual_cents
    FROM rateations r
    WHERE r.id = p_f24_id
      AND r.is_f24 = true
      AND r.owner_uid = auth.uid()
  ),
  pagopa_calc AS (
    SELECT
      -- Fallback per totale PagoPA:
      -- 1. residual_amount_cents (cache aggiornata)
      -- 2. (total_amount * 100 - paid_amount_cents) (ricalcolo)
      -- 3. 0 (fallback)
      COALESCE(
        p.residual_amount_cents,
        ((p.total_amount * 100)::bigint - COALESCE(p.paid_amount_cents, 0)),
        0
      )::bigint AS pagopa_total_cents
    FROM rateations p
    WHERE p.id = p_pagopa_id
      AND p.owner_uid = auth.uid()
      AND EXISTS (
        SELECT 1 FROM rateation_types rt 
        WHERE rt.id = p.type_id 
        AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
      )
  )
  SELECT
    f24_calc.f24_residual_cents,
    pagopa_calc.pagopa_total_cents,
    (pagopa_calc.pagopa_total_cents - f24_calc.f24_residual_cents) AS delta_cents
  FROM f24_calc, pagopa_calc;
$$;

-- Permessi
GRANT EXECUTE ON FUNCTION public.preview_link_f24_to_pagopa TO authenticated;

-- Documentazione
COMMENT ON FUNCTION public.preview_link_f24_to_pagopa IS 
'Calcola preview per collegamento F24→PagoPA: residuo F24 (con snapshot decadenza), totale PagoPA, delta (maggiorazione/risparmio). Include verifiche RLS e tipo.';