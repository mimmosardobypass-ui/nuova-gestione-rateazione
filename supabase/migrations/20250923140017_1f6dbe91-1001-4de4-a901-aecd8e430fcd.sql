-- Aggiorna view v_pagopa_linked_rq per usare snapshot con fallback intelligente
CREATE OR REPLACE VIEW v_pagopa_linked_rq AS
SELECT
  l.pagopa_id::text,
  l.riam_quater_id::text,
  l.linked_at,
  l.note,
  p.number AS pagopa_number,
  p.taxpayer_name AS pagopa_taxpayer,
  rq.number AS rq_number,
  rq.taxpayer_name AS rq_taxpayer,

  -- Snapshot con fallback al calcolo ignorando l'azzeramento
  COALESCE(
    l.residuo_pagopa_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
    ), 0)::numeric)
  ) AS residuo_pagopa_at_link_cents,

  COALESCE(
    l.totale_rq_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.riam_quater_id
    ), 0)::numeric)
  ) AS totale_rq_at_link_cents,

  COALESCE(
    l.risparmio_at_link_cents,
    GREATEST(
      COALESCE(l.residuo_pagopa_at_link_cents,
        ROUND(100 * COALESCE((
          SELECT SUM(i.amount) FROM installments i
          WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
        ), 0)::numeric)
      )
      -
      COALESCE(l.totale_rq_at_link_cents,
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
  residuo_pagopa_at_link_cents = COALESCE(
    l.residuo_pagopa_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
    ), 0)::numeric)
  ),
  totale_rq_at_link_cents = COALESCE(
    l.totale_rq_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.riam_quater_id
    ), 0)::numeric)
  ),
  risparmio_at_link_cents = COALESCE(
    l.risparmio_at_link_cents,
    GREATEST(
      COALESCE(l.residuo_pagopa_at_link_cents,
        ROUND(100 * COALESCE((
          SELECT SUM(i.amount) FROM installments i
          WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid, false) = false
        ), 0)::numeric)
      )
      -
      COALESCE(l.totale_rq_at_link_cents,
        ROUND(100 * COALESCE((
          SELECT SUM(i.amount) FROM installments i
          WHERE i.rateation_id = l.riam_quater_id
        ), 0)::numeric)
      ),
      0
    )
  )
WHERE l.residuo_pagopa_at_link_cents IS NULL
   OR l.totale_rq_at_link_cents IS NULL
   OR l.risparmio_at_link_cents IS NULL;