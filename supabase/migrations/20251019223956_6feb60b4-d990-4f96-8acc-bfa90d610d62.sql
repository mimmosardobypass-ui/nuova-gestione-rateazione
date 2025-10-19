-- Fix preview_link_f24_to_pagopa to use original total_amount instead of residual
-- The "Totale PagoPA" should show the full original amount, not what's left unpaid

CREATE OR REPLACE FUNCTION public.preview_link_f24_to_pagopa(p_f24_id bigint, p_pagopa_id bigint)
 RETURNS TABLE(f24_residual_cents bigint, pagopa_total_cents bigint, delta_cents bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH f24_calc AS (
    SELECT
      -- Residuo F24 al momento della decadenza (snapshot più accurato)
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
      -- CORRETTO: usa il totale ORIGINARIO della rateazione PagoPA
      -- Non il residuo (totale - pagato) perché la maggiorazione si calcola
      -- confrontando il residuo F24 decaduto con il piano PagoPA completo
      COALESCE(
        (p.total_amount * 100)::bigint,
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
$function$;