-- Drop existing view and recreate with canonical structure
DROP VIEW IF EXISTS v_rateations_list_ui;

CREATE VIEW v_rateations_list_ui AS
WITH r AS (
  SELECT
    ra.id,
    ra.owner_uid,
    ra.status,
    ra.number,
    ra.taxpayer_name,
    ra.type_id,
    ra.created_at,
    ra.updated_at,
    COALESCE(ra.is_f24, false) AS is_f24,
    COALESCE(ra.is_quater, false) AS is_quater,
    -- Derive is_pagopa from type name
    COALESCE(rt.name ILIKE '%pagopa%', false) AS is_pagopa,
    rt.name AS tipo
  FROM rateations ra
  LEFT JOIN rateation_types rt ON rt.id = ra.type_id
),
inst AS (
  SELECT
    i.rateation_id,
    -- Total: sum of all amount_cents
    SUM(COALESCE(i.amount_cents, 0)) AS total_amount_cents,
    
    -- Paid: sum amount_cents of installments with is_paid = true
    SUM(
      CASE WHEN i.is_paid = true 
      THEN COALESCE(i.amount_cents, 0) 
      ELSE 0 END
    ) AS paid_amount_cents,
    
    -- Effective overdue: overdue and unpaid installments
    SUM(
      CASE
        WHEN i.due_date < CURRENT_DATE
         AND i.is_paid = false
        THEN COALESCE(i.amount_cents, 0)
        ELSE 0
      END
    ) AS overdue_effective_cents,
    
    -- Counters
    COUNT(*) AS installments_total,
    COUNT(*) FILTER (WHERE i.is_paid = true) AS installments_paid,
    COUNT(*) FILTER (
      WHERE i.due_date < CURRENT_DATE AND i.is_paid = false
    ) AS installments_overdue_today
  FROM installments i
  GROUP BY i.rateation_id
)
SELECT
  r.id,
  r.owner_uid,
  r.status,
  r.number,
  r.taxpayer_name,
  r.tipo,
  r.type_id,
  r.created_at,
  r.updated_at,
  r.is_f24,
  r.is_quater,
  r.is_pagopa,
  
  -- Canonical monetary amounts (all in cents)
  COALESCE(inst.total_amount_cents, 0) AS total_amount_cents,
  COALESCE(inst.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(inst.overdue_effective_cents, 0) AS overdue_effective_cents,
  GREATEST(0, 
    COALESCE(inst.total_amount_cents, 0) - COALESCE(inst.paid_amount_cents, 0)
  ) AS residual_effective_cents,
  
  -- Counters  
  COALESCE(inst.installments_total, 0) AS installments_total,
  COALESCE(inst.installments_paid, 0) AS installments_paid,
  COALESCE(inst.installments_overdue_today, 0) AS installments_overdue_today
FROM r
LEFT JOIN inst ON inst.rateation_id = r.id;