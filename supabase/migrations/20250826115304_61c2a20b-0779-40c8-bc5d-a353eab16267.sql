-- Create timezone-safe PagoPA KPIs view
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
  /* limite salti: configurabile, fallback 8 */
  COALESCE(r.max_pagopa_skips, 8)   AS max_skips_effective,
  GREATEST(
    0,
    COALESCE(r.max_pagopa_skips, 8) - COALESCE((
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