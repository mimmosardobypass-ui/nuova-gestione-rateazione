-- Create enhanced deadlines view for dashboard
CREATE OR REPLACE VIEW v_scadenze AS
SELECT
  i.id,
  i.rateation_id,
  i.seq,
  i.due_date,
  i.amount,
  i.is_paid,
  i.paid_at,
  i.owner_uid,
  r.number as rateation_number,
  r.taxpayer_name,
  rt.name as type_name,
  rt.id as type_id,
  DATE_TRUNC('month', i.due_date)::date as due_month,
  DATE_TRUNC('week', i.due_date)::date as due_week,
  CASE
    WHEN i.is_paid THEN 'Pagata'
    WHEN i.due_date < CURRENT_DATE THEN 'In ritardo'
    WHEN i.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Entro 7 giorni'
    WHEN i.due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Entro 30 giorni'
    ELSE 'Futuro'
  END as bucket,
  CASE
    WHEN i.is_paid OR i.due_date >= CURRENT_DATE THEN NULL
    WHEN CURRENT_DATE - i.due_date <= 7 THEN '1–7'
    WHEN CURRENT_DATE - i.due_date <= 30 THEN '8–30'
    WHEN CURRENT_DATE - i.due_date <= 60 THEN '31–60'
    ELSE '>60'
  END as aging_band,
  CASE
    WHEN i.is_paid OR i.due_date >= CURRENT_DATE THEN 0
    ELSE CURRENT_DATE - i.due_date
  END as days_overdue
FROM installments i
JOIN rateations r ON r.id = i.rateation_id
JOIN rateation_types rt ON rt.id = r.type_id;

-- Enable RLS on the view (inherits from underlying tables)
ALTER VIEW v_scadenze OWNER TO postgres;