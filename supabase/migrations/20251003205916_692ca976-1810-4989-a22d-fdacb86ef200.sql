-- STEP A: Allineamento completo owner_uid (copre NULL e mismatch)
UPDATE public.installments i
SET owner_uid = r.owner_uid
FROM public.rateations r
WHERE i.rateation_id = r.id
  AND (i.owner_uid IS DISTINCT FROM r.owner_uid);

-- STEP B: Ricrea v_pagopa_linked_rq con CTE per calcolo coerente risparmio
DROP VIEW IF EXISTS v_pagopa_linked_rq;

CREATE OR REPLACE VIEW v_pagopa_linked_rq AS
WITH base AS (
  SELECT
    l.pagopa_id,
    l.riam_quater_id,
    l.created_at,
    l.reason,
    p.owner_uid,
    p.number AS pagopa_number,
    COALESCE(l.pagopa_taxpayer_at_link, p.taxpayer_name) AS pagopa_taxpayer,
    rq.number AS rq_number,
    COALESCE(l.rq_taxpayer_at_link, rq.taxpayer_name) AS rq_taxpayer,

    -- Fallback RLS-safe (via vista v_installments_status, usa amount * 100)
    COALESCE(
      l.pagopa_residual_at_link_cents,
      (SELECT COALESCE(SUM(i.amount * 100), 0)::bigint
       FROM v_installments_status i
       WHERE i.rateation_id = l.pagopa_id
         AND i.is_paid = FALSE)
    ) AS residuo_cents,

    COALESCE(
      l.rq_total_at_link_cents,
      (SELECT COALESCE(SUM(i.amount * 100), 0)::bigint
       FROM v_installments_status i
       WHERE i.rateation_id = l.riam_quater_id)
    ) AS totale_cents
  FROM riam_quater_links l
  JOIN rateations p ON p.id = l.pagopa_id
  JOIN rateations rq ON rq.id = l.riam_quater_id
  WHERE l.unlinked_at IS NULL
)
SELECT
  pagopa_id,
  pagopa_number,
  pagopa_taxpayer,
  riam_quater_id,
  rq_number,
  rq_taxpayer,
  created_at AS linked_at,
  reason AS note,

  -- Esponi i campi con fallback coerenti
  residuo_cents AS residuo_pagopa_at_link_cents,
  totale_cents AS totale_rq_at_link_cents,
  GREATEST(residuo_cents - totale_cents, 0)::bigint AS risparmio_at_link_cents
FROM base;

-- STEP C: Backfill snapshot idempotente (solo dove mancano)
UPDATE riam_quater_links l
SET
  pagopa_residual_at_link_cents = COALESCE(
    l.pagopa_residual_at_link_cents,
    (SELECT COALESCE(SUM(i.amount_cents), 0)
     FROM installments i
     WHERE i.rateation_id = l.pagopa_id
       AND i.is_paid = FALSE)),
  rq_total_at_link_cents = COALESCE(
    l.rq_total_at_link_cents,
    (SELECT COALESCE(SUM(i.amount_cents), 0)
     FROM installments i
     WHERE i.rateation_id = l.riam_quater_id))
WHERE
  l.pagopa_residual_at_link_cents IS NULL
  OR l.rq_total_at_link_cents IS NULL;