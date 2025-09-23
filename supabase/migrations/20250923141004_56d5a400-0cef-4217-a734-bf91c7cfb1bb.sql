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

-- 3) Hardening: Sostituisci risparmio_at_link_cents con generated column
ALTER TABLE riam_quater_links
DROP COLUMN IF EXISTS risparmio_at_link_cents;

ALTER TABLE riam_quater_links
ADD COLUMN risparmio_at_link_cents bigint GENERATED ALWAYS AS (
  GREATEST(COALESCE(pagopa_residual_at_link_cents,0) - COALESCE(rq_total_at_link_cents,0), 0)
) STORED;