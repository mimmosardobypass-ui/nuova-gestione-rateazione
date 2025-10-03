-- STEP 1: Force status = 'INTERROTTA' for N.34 PagoPA (id = 55 only)
UPDATE rateations
SET status = 'INTERROTTA',
    interruption_reason = COALESCE(interruption_reason, 'RQ_LINK'),
    interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
WHERE id = 55
  AND status != 'INTERROTTA';

-- STEP 2: Update v_rateations_list_ui to expose linked_rq_numbers, linked_rq_ids, is_interrupted
-- and fix linked_rq_count to use COUNT(DISTINCT)
DROP VIEW IF EXISTS v_rateations_list_ui CASCADE;

CREATE VIEW v_rateations_list_ui AS
WITH r AS (
  SELECT
    id, owner_uid, number, tipo, taxpayer_name, status,
    is_pagopa, is_f24, type_id, created_at, updated_at,
    total_amount, paid_amount_cents, residual_amount_cents, overdue_amount_cents
  FROM v_rateations_with_kpis
),
inst AS (
  SELECT
    rateation_id,
    COUNT(*)::bigint as installments_total,
    COUNT(*) FILTER (WHERE is_paid = true)::bigint as installments_paid,
    COUNT(*) FILTER (WHERE is_paid = false AND due_date < CURRENT_DATE)::bigint as installments_overdue_today
  FROM v_installments_effective
  GROUP BY rateation_id
),
rq_links AS (
  SELECT
    l.pagopa_id,
    -- Fix: Use COUNT(DISTINCT) to avoid duplicate counting
    COUNT(DISTINCT l.riam_quater_id) FILTER (WHERE l.unlinked_at IS NULL)::bigint as linked_rq_count,
    -- New: Array of RQ numbers (DISTINCT, ordered)
    ARRAY_AGG(DISTINCT rq.number ORDER BY rq.number) FILTER (WHERE l.unlinked_at IS NULL) as linked_rq_numbers,
    -- New: Array of RQ IDs (DISTINCT, ordered by number) - using subquery to avoid DISTINCT/ORDER BY conflict
    (
      SELECT array_agg(rq_sub.id ORDER BY rq_sub.number)
      FROM (
        SELECT DISTINCT l2.riam_quater_id as id, rq2.number
        FROM riam_quater_links l2
        JOIN rateations rq2 ON rq2.id = l2.riam_quater_id
        WHERE l2.pagopa_id = l.pagopa_id AND l2.unlinked_at IS NULL
      ) rq_sub
    )::bigint[] as linked_rq_ids,
    -- Keep latest for backward compatibility
    (
      SELECT rq2.number
      FROM riam_quater_links l2
      JOIN rateations rq2 ON rq2.id = l2.riam_quater_id
      WHERE l2.pagopa_id = l.pagopa_id AND l2.unlinked_at IS NULL
      ORDER BY l2.created_at DESC LIMIT 1
    ) as latest_linked_rq_number,
    (
      SELECT l2.riam_quater_id::bigint
      FROM riam_quater_links l2
      WHERE l2.pagopa_id = l.pagopa_id AND l2.unlinked_at IS NULL
      ORDER BY l2.created_at DESC LIMIT 1
    ) as latest_rq_id
  FROM riam_quater_links l
  JOIN rateations rq ON rq.id = l.riam_quater_id
  GROUP BY l.pagopa_id
)
SELECT
  r.id, r.owner_uid, r.number, r.tipo, r.taxpayer_name,
  r.status,
  r.is_pagopa, r.is_f24, r.type_id,
  r.created_at, r.updated_at,
  
  -- Monetary fields
  (r.total_amount * 100)::bigint as total_amount_cents,
  r.paid_amount_cents,
  r.residual_amount_cents as residual_effective_cents,
  r.overdue_amount_cents as overdue_effective_cents,
  
  -- Installment counters
  COALESCE(inst.installments_total, 0) as installments_total,
  COALESCE(inst.installments_paid, 0) as installments_paid,
  COALESCE(inst.installments_overdue_today, 0) as installments_overdue_today,
  
  -- Quater detection (existing logic)
  CASE WHEN UPPER(COALESCE(r.tipo, '')) LIKE '%QUATER%' THEN true ELSE false END as is_quater,
  NULL::bigint as original_total_due_cents,
  NULL::bigint as quater_total_due_cents,
  
  -- RQ link info (existing + new)
  COALESCE(rq.linked_rq_count, 0) as linked_rq_count,
  rq.latest_linked_rq_number,
  rq.latest_rq_id,
  -- NEW: Arrays for rich UI
  rq.linked_rq_numbers,
  rq.linked_rq_ids,
  -- NEW: Explicit interruption flag
  (r.status = 'INTERROTTA') as is_interrupted

FROM r
LEFT JOIN inst ON inst.rateation_id = r.id
LEFT JOIN rq_links rq ON rq.pagopa_id = r.id;

GRANT SELECT ON v_rateations_list_ui TO authenticated;