-- Fix definitivo per il Risparmio stimato: 2 query sequenziali + generated column

-- 1) Prima query: Allinea gli snapshot se fossero rimasti NULL
UPDATE riam_quater_links l
SET
  pagopa_residual_at_link_cents = COALESCE(
    l.pagopa_residual_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.pagopa_id AND COALESCE(i.is_paid,false)=false
    ),0)::numeric)
  ),
  rq_total_at_link_cents = COALESCE(
    l.rq_total_at_link_cents,
    ROUND(100 * COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = l.riam_quater_id
    ),0)::numeric)
  );

-- 2) Seconda query: Ricalcola il risparmio DOPO che i due valori sono stati aggiornati
UPDATE riam_quater_links l
SET risparmio_at_link_cents = GREATEST(
  COALESCE(l.pagopa_residual_at_link_cents,0) - COALESCE(l.rq_total_at_link_cents,0),
  0
)
WHERE
  COALESCE(l.pagopa_residual_at_link_cents,0) <> 0
  OR COALESCE(l.rq_total_at_link_cents,0) <> 0;

-- 3) Hardening: Drop view prima di modificare la colonna
DROP VIEW IF EXISTS v_pagopa_linked_rq;

-- 4) Sostituisci risparmio_at_link_cents con generated column
ALTER TABLE riam_quater_links
DROP COLUMN risparmio_at_link_cents CASCADE;

ALTER TABLE riam_quater_links
ADD COLUMN risparmio_at_link_cents bigint GENERATED ALWAYS AS (
  GREATEST(COALESCE(pagopa_residual_at_link_cents,0) - COALESCE(rq_total_at_link_cents,0), 0)
) STORED;

-- 5) Ricrea la view (ora semplificate perché risparmio è sempre calcolato)
CREATE VIEW v_pagopa_linked_rq AS
SELECT
  l.pagopa_id::text,
  l.riam_quater_id::text,
  l.created_at AS linked_at,
  l.reason AS note,
  p.number AS pagopa_number,
  p.taxpayer_name AS pagopa_taxpayer,
  rq.number AS rq_number,
  rq.taxpayer_name AS rq_taxpayer,
  l.pagopa_residual_at_link_cents AS residuo_pagopa_at_link_cents,
  l.rq_total_at_link_cents AS totale_rq_at_link_cents,
  l.risparmio_at_link_cents AS risparmio_at_link_cents
FROM riam_quater_links l
JOIN rateations p ON p.id = l.pagopa_id
JOIN rateations rq ON rq.id = l.riam_quater_id;