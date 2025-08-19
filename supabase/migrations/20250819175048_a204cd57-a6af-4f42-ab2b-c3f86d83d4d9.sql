-- Create enhanced rateation summary view for print reports
CREATE OR REPLACE VIEW v_rateation_summary AS
SELECT
  r.id,
  r.number as numero,
  rt.name as type_name,
  r.taxpayer_name,
  r.total_amount as importo_totale,
  COALESCE(SUM(CASE WHEN i.is_paid THEN i.amount ELSE 0 END), 0) as importo_pagato_quota,
  COALESCE(SUM(CASE WHEN i.is_paid THEN COALESCE(i.extra_interest_euro,0) + COALESCE(i.extra_penalty_euro,0) ELSE 0 END), 0) as extra_ravv_pagati,
  COALESCE(SUM(CASE WHEN NOT i.is_paid THEN i.amount ELSE 0 END), 0) as totale_residuo,
  COUNT(i.id) as rate_totali,
  COUNT(i.id) FILTER (WHERE i.is_paid) as rate_pagate,
  COUNT(i.id) FILTER (WHERE NOT i.is_paid AND i.due_date < CURRENT_DATE) as rate_in_ritardo,
  COUNT(i.id) FILTER (WHERE i.is_paid AND i.payment_mode = 'ravvedimento') as rate_pagate_ravv,
  MIN(i.due_date) as first_due_date,
  MAX(i.due_date) as last_due_date,
  GREATEST(r.updated_at, MAX(i.paid_recorded_at)) as last_activity
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
LEFT JOIN installments i ON i.rateation_id = r.id
GROUP BY r.id, r.number, rt.name, r.taxpayer_name, r.total_amount, r.updated_at;

-- Create installments view for detailed rateation print
CREATE OR REPLACE VIEW v_rateation_installments AS
SELECT
  i.id, 
  i.rateation_id, 
  i.seq,
  i.due_date, 
  i.amount,
  CASE 
    WHEN i.is_paid THEN 'paid'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'unpaid'
  END as status,
  i.payment_mode,
  i.paid_date,
  COALESCE(i.extra_interest_euro, 0) as extra_interest,
  COALESCE(i.extra_penalty_euro, 0) as extra_penalty,
  CASE 
    WHEN i.due_date < CURRENT_DATE THEN GREATEST(0, (CURRENT_DATE - i.due_date))
    ELSE 0
  END as days_overdue
FROM installments i;

-- Create monthly deadlines forecast view
CREATE OR REPLACE VIEW v_deadlines_monthly AS
SELECT
  DATE_TRUNC('month', due_date)::date as month,
  SUM(amount) as amount,
  COUNT(*) as cnt,
  owner_uid
FROM installments
WHERE NOT is_paid
GROUP BY DATE_TRUNC('month', due_date)::date, owner_uid
ORDER BY month;