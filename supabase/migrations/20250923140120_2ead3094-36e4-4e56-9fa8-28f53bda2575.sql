-- Aggiorna view v_pagopa_linked_rq per usare snapshot con fallback intelligente  
CREATE OR REPLACE VIEW v_pagopa_linked_rq AS
SELECT
  l.pagopa_id::text,
  l.riam_quater_id::text,
  l.created_at AS linked_at,
  l.reason AS note,
  p.number AS pagopa_number,
  p.taxpayer_name AS pagopa_taxpayer,
  rq.number AS rq_number,
  rq.taxpayer_name AS rq_taxpayer,

  -- Snapshot con fallback al calcolo ignorando l'azzeramento
  COALESCE(
    l.pagopa_residual_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
    ), 0)::numeric)
  ) AS residuo_pagopa_at_link_cents,

  COALESCE(
    l.rq_total_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.riam_quater_id
    ), 0)::numeric)
  ) AS totale_rq_at_link_cents,

  COALESCE(
    l.risparmio_at_link_cents,
    GREATEST(
      COALESCE(l.pagopa_residual_at_link_cents,
        ROUND(100 * COALESCE((
          SELECT SUM(i.amount) FROM installments i
          WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
        ), 0)::numeric)
      )
      -
      COALESCE(l.rq_total_at_link_cents,
        ROUND(100 * COALESCE((
          SELECT SUM(i.amount) FROM installments i
          WHERE i.rateation_id = l.riam_quater_id
        ), 0)::numeric)
      ),
      0
    )
  ) AS risparmio_at_link_cents
FROM riam_quater_links l
JOIN rateations p ON p.id = l.pagopa_id
JOIN rateations rq ON rq.id = l.riam_quater_id;

-- Backfill per i collegamenti esistenti (popola gli snapshot mancanti)
UPDATE riam_quater_links l
SET
  pagopa_residual_at_link_cents = COALESCE(
    l.pagopa_residual_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
    ), 0)::numeric)
  ),
  rq_total_at_link_cents = COALESCE(
    l.rq_total_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.riam_quater_id
    ), 0)::numeric)
  )
WHERE l.pagopa_residual_at_link_cents IS NULL
   OR l.rq_total_at_link_cents IS NULL;

-- Calcola e aggiorna risparmio_at_link_cents dove mancante
UPDATE riam_quater_links l
SET risparmio_at_link_cents = GREATEST(
  COALESCE(l.pagopa_residual_at_link_cents, 0) - COALESCE(l.rq_total_at_link_cents, 0), 
  0
)
WHERE l.risparmio_at_link_cents IS NULL;