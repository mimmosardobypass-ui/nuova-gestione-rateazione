-- Create monthly metrics view for annual matrix heatmap
CREATE OR REPLACE VIEW public.v_monthly_metrics AS
WITH base AS (
  SELECT
    date_part('year', i.due_date)::int  AS year,
    date_part('month', i.due_date)::int AS month,
    COALESCE(i.amount, 0)::numeric AS amount,
    COALESCE(i.extra_interest_euro, 0) + COALESCE(i.extra_penalty_euro, 0) AS extra_ravv,
    CASE WHEN i.paid_date IS NOT NULL THEN COALESCE(i.amount, 0) ELSE 0 END AS amount_paid,
    CASE WHEN i.paid_date IS NULL AND i.due_date < CURRENT_DATE THEN COALESCE(i.amount, 0) ELSE 0 END AS amount_overdue,
    i.paid_date,
    i.owner_uid
  FROM public.installments i
  WHERE i.owner_uid IS NOT NULL
)
SELECT
  owner_uid,
  year,
  month,
  SUM(amount)         AS due_amount,
  SUM(amount_paid)    AS paid_amount,
  SUM(amount_overdue) AS overdue_amount,
  SUM(extra_ravv)     AS extra_ravv_amount,
  COUNT(*)            AS installments_count,
  SUM(CASE WHEN paid_date IS NOT NULL THEN 1 ELSE 0 END) AS paid_count
FROM base
GROUP BY owner_uid, year, month
ORDER BY owner_uid, year, month;