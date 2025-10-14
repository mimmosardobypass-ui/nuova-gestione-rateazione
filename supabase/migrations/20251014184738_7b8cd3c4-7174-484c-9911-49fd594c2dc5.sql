-- Fix v_scadenze to exclude INTERROTTA and decaduta rateations from deadlines
-- This ensures only truly active rateations contribute to deadline calculations

DROP VIEW IF EXISTS v_scadenze;

CREATE VIEW v_scadenze AS
SELECT
  i.id,
  i.rateation_id,
  i.seq,
  i.due_date,
  i.amount,
  COALESCE(i.is_paid, false) as is_paid,
  i.paid_at,
  r.number as rateation_number,
  r.taxpayer_name,
  t.name as type_name,
  t.id as type_id,
  r.status as rateation_status,
  i.owner_uid,

  -- Enhanced bucket classification with "Oggi"
  CASE
    WHEN COALESCE(i.is_paid, false) THEN 'Pagata'
    WHEN i.due_date < CURRENT_DATE THEN 'In ritardo'
    WHEN i.due_date = CURRENT_DATE THEN 'Oggi'
    WHEN i.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Entro 7 giorni'
    WHEN i.due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Entro 30 giorni'
    ELSE 'Futuro'
  END as bucket,

  -- Aging band for overdue unpaid installments
  CASE
    WHEN COALESCE(i.is_paid, false) = false AND i.due_date < CURRENT_DATE THEN
      CASE
        WHEN CURRENT_DATE - i.due_date BETWEEN 1 AND 7 THEN '1–7'
        WHEN CURRENT_DATE - i.due_date BETWEEN 8 AND 30 THEN '8–30'
        WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN '31–60'
        ELSE '>60'
      END
    ELSE NULL
  END as aging_band,

  -- Enhanced days overdue calculation (for both unpaid overdue and late payments)
  GREATEST(
    CASE
      WHEN COALESCE(i.is_paid, false) = false AND i.due_date < CURRENT_DATE
      THEN (CURRENT_DATE - i.due_date)
      WHEN COALESCE(i.is_paid, false) = true AND i.paid_at::date > i.due_date
      THEN (i.paid_at::date - i.due_date)
      ELSE 0
    END, 0
  )::int as days_overdue,

  -- Additional useful fields for UI
  DATE_TRUNC('month', i.due_date)::date as due_month,
  DATE_TRUNC('week', i.due_date)::date as due_week

FROM installments i
JOIN rateations r ON r.id = i.rateation_id
LEFT JOIN rateation_types t ON t.id = r.type_id
-- CRITICAL FIX: Exclude INTERROTTA, decaduta, and deleted rateations
WHERE COALESCE(r.status, 'attiva') NOT IN ('INTERROTTA', 'decaduta')
  AND COALESCE(r.is_deleted, false) = false;