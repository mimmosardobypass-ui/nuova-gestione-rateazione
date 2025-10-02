-- Fix v_pagopa_linked_rq: DROP e ricrea senza cast ::text su ID
-- Rimuove cast che causavano "invalid input syntax for type bigint"

DROP VIEW IF EXISTS v_pagopa_linked_rq;

CREATE VIEW v_pagopa_linked_rq AS
SELECT
  l.pagopa_id,              -- bigint nativo (era ::text)
  p.number           AS pagopa_number,
  COALESCE(l.pagopa_taxpayer_at_link, p.taxpayer_name) AS pagopa_taxpayer,
  l.riam_quater_id,         -- bigint nativo (era ::text)
  rq.number          AS rq_number,
  COALESCE(l.rq_taxpayer_at_link, rq.taxpayer_name)    AS rq_taxpayer,
  l.created_at       AS linked_at,
  l.reason           AS note,

  -- importi "fotografati" (fallback ai valori attuali se null)
  COALESCE(l.pagopa_residual_at_link_cents,
           (SELECT COALESCE(SUM(i.amount_cents), 0)
              FROM installments i
             WHERE i.rateation_id = l.pagopa_id AND i.is_paid = FALSE)
  ) AS residuo_pagopa_at_link_cents,

  COALESCE(l.rq_total_at_link_cents,
           (SELECT COALESCE(SUM(i.amount_cents), 0)
              FROM installments i
             WHERE i.rateation_id = l.riam_quater_id)
  ) AS totale_rq_at_link_cents,

  GREATEST(
    COALESCE(l.pagopa_residual_at_link_cents, 
             (SELECT COALESCE(SUM(i.amount_cents), 0)
                FROM installments i
               WHERE i.rateation_id = l.pagopa_id AND i.is_paid = FALSE), 0) -
    COALESCE(l.rq_total_at_link_cents,
             (SELECT COALESCE(SUM(i.amount_cents), 0)
                FROM installments i
               WHERE i.rateation_id = l.riam_quater_id), 0),
    0
  ) AS risparmio_at_link_cents

FROM riam_quater_links l
JOIN rateations p  ON p.id  = l.pagopa_id
JOIN rateations rq ON rq.id = l.riam_quater_id;