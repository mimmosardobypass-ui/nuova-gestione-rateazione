-- Create view for PagoPA unpaid today KPIs
CREATE OR REPLACE VIEW v_pagopa_unpaid_today AS
SELECT
  r.id AS rateation_id,
  COUNT(*) FILTER (WHERE i.is_paid = true) AS paid_count,
  COUNT(*) FILTER (WHERE i.is_paid = false) AS unpaid_count,
  COUNT(*) FILTER (WHERE i.is_paid = false AND i.due_date < CURRENT_DATE) AS unpaid_overdue_today,
  COUNT(*) FILTER (
    WHERE i.is_paid = true
      AND COALESCE(i.paid_date, i.paid_at)::date > i.due_date
  ) AS paid_late_count,
  GREATEST(0, 8 - COUNT(*) FILTER (WHERE i.is_paid = false AND i.due_date < CURRENT_DATE)) AS skip_remaining,
  (COUNT(*) FILTER (WHERE i.is_paid = false AND i.due_date < CURRENT_DATE)) >= 8 AS at_risk_decadence
FROM rateations r
JOIN installments i ON i.rateation_id = r.id
JOIN rateation_types rt ON rt.id = r.type_id
WHERE UPPER(rt.name) = 'PAGOPA'
GROUP BY r.id;

-- Create performance index for installments queries
CREATE INDEX IF NOT EXISTS idx_installments_rate_due_paid
  ON installments(rateation_id, is_paid, due_date);