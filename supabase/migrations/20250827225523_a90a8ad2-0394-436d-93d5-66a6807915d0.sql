-- Create canonical KPI view for rateations with timezone-safe calculations
CREATE OR REPLACE VIEW public.v_rateations_with_kpis AS
WITH base AS (
  SELECT
    r.id                         AS rateation_id,
    r.owner_uid,
    r.number,
    r.taxpayer_name,
    r.total_amount,
    r.type_id,
    r.status,
    r.is_f24,
    r.created_at,
    r.updated_at,
    r.paid_amount_cents,
    r.residual_amount_cents,
    r.overdue_amount_cents,
    -- Get rateation type info
    rt.name as type_name,
    -- Determine tipo based on type name
    CASE 
      WHEN UPPER(COALESCE(rt.name, '')) = 'PAGOPA' THEN 'PagoPA'
      WHEN UPPER(COALESCE(rt.name, '')) = 'F24' THEN 'F24'
      ELSE COALESCE(rt.name, 'Altro')
    END as tipo,
    (NOW() AT TIME ZONE 'Europe/Rome')::date AS today_it
  FROM public.rateations r
  LEFT JOIN public.rateation_types rt ON r.type_id = rt.id
),
installment_calcs AS (
  SELECT
    i.rateation_id,
    -- Robust is_paid coercion: handle '1','true','t' => true; '0','false','f' => false
    CASE
      WHEN i.is_paid::text IN ('1','true','t','TRUE','T') THEN true
      WHEN i.is_paid::text IN ('0','false','f','FALSE','F') THEN false
      ELSE COALESCE(i.is_paid::boolean, false)
    END AS paid_bool,
    i.due_date::date AS due_dt
  FROM public.installments i
)
SELECT
  b.rateation_id          AS id,
  b.owner_uid,
  b.number,
  b.taxpayer_name,
  b.total_amount,
  b.type_id,
  b.type_name,
  b.tipo,
  b.status,
  b.is_f24,
  b.created_at,
  b.updated_at,
  b.paid_amount_cents,
  b.residual_amount_cents,
  b.overdue_amount_cents,
  
  -- PagoPA KPI calculations
  8 AS max_skips_effective,
  
  -- Conteggi
  COUNT(*) FILTER (WHERE ic.paid_bool = false AND ic.due_dt < b.today_it) AS unpaid_overdue_today,
  COUNT(*) FILTER (WHERE ic.paid_bool = false AND ic.due_dt = b.today_it) AS unpaid_due_today,
  
  -- Derivati
  GREATEST(0, 8 - COUNT(*) FILTER (WHERE ic.paid_bool = false AND ic.due_dt < b.today_it)) AS skip_remaining,
  (COUNT(*) FILTER (WHERE ic.paid_bool = false AND ic.due_dt < b.today_it)) >= 8 AS at_risk_decadence,
  
  -- Additional metrics for compatibility
  COUNT(*) AS rate_totali,
  COUNT(*) FILTER (WHERE ic.paid_bool = true) AS rate_pagate,
  COUNT(*) FILTER (WHERE ic.paid_bool = false AND ic.due_dt < b.today_it) AS rate_in_ritardo,
  (b.total_amount - (b.paid_amount_cents::numeric / 100)) AS residuo

FROM base b
LEFT JOIN installment_calcs ic ON ic.rateation_id = b.rateation_id
GROUP BY 
  b.rateation_id, b.owner_uid, b.number, b.taxpayer_name, b.total_amount, 
  b.type_id, b.type_name, b.tipo, b.status, b.is_f24, b.created_at, b.updated_at,
  b.paid_amount_cents, b.residual_amount_cents, b.overdue_amount_cents, b.today_it
ORDER BY b.rateation_id;