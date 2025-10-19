-- Drop and recreate v_rateations_list_ui to add interruption fields
-- This enables F24→PagoPA link display in RateationNumberCell component

DROP VIEW IF EXISTS public.v_rateations_list_ui CASCADE;

CREATE VIEW public.v_rateations_list_ui AS
WITH r AS (
  SELECT 
    ra.id,
    ra.owner_uid,
    ra.status,
    ra.number,
    ra.taxpayer_name,
    ra.is_f24,
    ra.is_quater,
    ra.created_at,
    ra.updated_at,
    ra.type_id,
    -- NEW: interruption fields for F24→PagoPA and PagoPA→RQ link display
    ra.interruption_reason,
    ra.interrupted_at,
    ra.interrupted_by_rateation_id,
    rt.name AS tipo,
    COALESCE(
      EXISTS (
        SELECT 1 
        FROM rateation_types rt2 
        WHERE rt2.id = ra.type_id 
        AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
      ), 
      false
    ) AS is_pagopa
  FROM rateations ra
  LEFT JOIN rateation_types rt ON rt.id = ra.type_id
  WHERE COALESCE(ra.is_deleted, false) = false
),
inst AS (
  SELECT 
    i.rateation_id,
    SUM(COALESCE(i.amount, 0) * 100)::BIGINT AS total_amount_cents,
    SUM(
      CASE 
        WHEN i.is_paid = true 
        THEN COALESCE(i.paid_total_cents::NUMERIC, i.amount * 100, 0)
        ELSE 0 
      END
    )::BIGINT AS paid_amount_cents,
    SUM(
      CASE 
        WHEN i.due_date < CURRENT_DATE AND i.is_paid = false 
        THEN COALESCE(i.amount, 0) * 100
        ELSE 0 
      END
    )::BIGINT AS overdue_effective_cents,
    COUNT(*) AS installments_total,
    COUNT(*) FILTER (WHERE i.is_paid = true) AS installments_paid,
    COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND i.is_paid = false) AS installments_overdue_today
  FROM installments i
  GROUP BY i.rateation_id
),
rq_links AS (
  SELECT 
    l.pagopa_id,
    COUNT(l.riam_quater_id) AS linked_rq_count,
    MAX(rq.number) AS latest_linked_rq_number,
    MAX(l.riam_quater_id) AS latest_rq_id,
    SUM(COALESCE(l.allocated_residual_cents, 0)) AS allocated_residual_cents,
    MAX(l.rq_total_at_link_cents) AS rq_total_at_link_cents
  FROM riam_quater_links l
  LEFT JOIN rateations rq ON rq.id = l.riam_quater_id
  WHERE l.unlinked_at IS NULL
  GROUP BY l.pagopa_id
)
SELECT 
  r.id,
  r.owner_uid,
  r.status,
  r.tipo,
  r.number,
  r.taxpayer_name,
  r.is_f24,
  r.is_quater,
  r.is_pagopa,
  r.created_at,
  r.updated_at,
  r.type_id,
  -- NEW: interruption fields
  r.interruption_reason,
  r.interrupted_at,
  r.interrupted_by_rateation_id,
  -- Monetary fields
  COALESCE(inst.total_amount_cents, 0) AS total_amount_cents,
  COALESCE(inst.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(inst.overdue_effective_cents, 0) AS overdue_effective_cents,
  GREATEST(0, COALESCE(inst.total_amount_cents, 0) - COALESCE(inst.paid_amount_cents, 0)) AS residual_effective_cents,
  -- Installment counters
  COALESCE(inst.installments_total, 0) AS installments_total,
  COALESCE(inst.installments_paid, 0) AS installments_paid,
  COALESCE(inst.installments_overdue_today, 0) AS installments_overdue_today,
  -- RQ link fields
  COALESCE(rl.linked_rq_count, 0) AS linked_rq_count,
  rl.latest_linked_rq_number,
  rl.latest_rq_id,
  COALESCE(rl.allocated_residual_cents, 0) AS allocated_residual_cents,
  rl.rq_total_at_link_cents
FROM r
LEFT JOIN inst ON inst.rateation_id = r.id
LEFT JOIN rq_links rl ON rl.pagopa_id = r.id;