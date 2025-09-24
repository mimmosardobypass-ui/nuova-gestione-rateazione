-- Drop existing view and recreate with correct logic
DROP VIEW IF EXISTS v_rateations_list_ui;

-- VISTA CANONICA PER LA LISTA (importi in cents)
CREATE OR REPLACE VIEW v_rateations_list_ui AS
WITH r AS (
  SELECT
    ra.id,
    ra.owner_uid,
    ra.status,
    rt.name as tipo,
    ra.number,
    ra.taxpayer_name,
    ra.created_at,
    ra.updated_at,
    ra.type_id,
    COALESCE(ra.is_f24, false) as is_f24,
    COALESCE(ra.is_quater, false) as is_quater,
    ra.original_total_due_cents,
    ra.quater_total_due_cents,
    -- Detect PagoPA from type name
    (UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%') as is_pagopa
  FROM rateations ra
  LEFT JOIN rateation_types rt ON rt.id = ra.type_id
),
inst AS (
  SELECT
    i.rateation_id,
    -- Use amount * 100 since amount_cents might be NULL
    SUM(COALESCE(i.amount * 100, 0))::bigint as total_amount_cents,
    -- Calculate paid amount from paid installments
    SUM(
      CASE 
        WHEN i.is_paid = true 
        THEN COALESCE(i.amount * 100, 0)
        ELSE 0
      END
    )::bigint as paid_amount_cents,
    -- Calculate overdue from unpaid installments past due date
    SUM(
      CASE
        WHEN i.due_date < CURRENT_DATE
         AND i.is_paid = false
        THEN COALESCE(i.amount * 100, 0)
        ELSE 0
      END
    )::bigint as overdue_effective_cents,
    COUNT(*)::bigint as installments_total,
    COUNT(*) FILTER (WHERE i.is_paid = true)::bigint as installments_paid,
    COUNT(*) FILTER (
      WHERE i.due_date < CURRENT_DATE AND i.is_paid = false
    )::bigint as installments_overdue_today
  FROM installments i
  GROUP BY i.rateation_id
)
SELECT
  r.id,
  r.owner_uid,
  r.status,
  r.tipo,
  r.number,
  r.taxpayer_name,
  r.created_at,
  r.updated_at,
  r.type_id,
  r.is_f24,
  r.is_quater,
  r.original_total_due_cents,
  r.quater_total_due_cents,
  r.is_pagopa,
  COALESCE(inst.total_amount_cents, 0) as total_amount_cents,
  COALESCE(inst.paid_amount_cents, 0) as paid_amount_cents,
  COALESCE(inst.overdue_effective_cents, 0) as overdue_effective_cents,
  GREATEST(
    0,
    COALESCE(inst.total_amount_cents, 0) - COALESCE(inst.paid_amount_cents, 0)
  )::bigint as residual_effective_cents,
  COALESCE(inst.installments_total, 0) as installments_total,
  COALESCE(inst.installments_paid, 0) as installments_paid,
  COALESCE(inst.installments_overdue_today, 0) as installments_overdue_today
FROM r
LEFT JOIN inst ON inst.rateation_id = r.id;

-- Grant permissions
GRANT SELECT ON v_rateations_list_ui TO authenticated;