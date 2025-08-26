-- Create timezone-safe PagoPA KPIs view (without max_pagopa_skips column)
CREATE OR REPLACE VIEW v_pagopa_today_kpis AS
SELECT
  r.id                             AS rateation_id,
  /* rate non pagate alla data odierna (scadute) */
  COALESCE((
    SELECT count(*)
    FROM installments i
    WHERE i.rateation_id = r.id
      AND i.is_paid = false
      AND (i.due_date)::date < CURRENT_DATE
  ), 0)                             AS unpaid_overdue_today,
  /* limite salti: hardcoded a 8 per ora */
  8                                 AS max_skips_effective,
  GREATEST(
    0,
    8 - COALESCE((
      SELECT count(*)
      FROM installments i
      WHERE i.rateation_id = r.id
        AND i.is_paid = false
        AND (i.due_date)::date < CURRENT_DATE
    ),0)
  )                                 AS skip_remaining
FROM rateations r
JOIN rateation_types t ON t.id = r.type_id
WHERE UPPER(t.name) = 'PAGOPA';