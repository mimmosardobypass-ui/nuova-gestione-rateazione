-- Enhance v_rateations_list_ui with RQ link information for PagoPA rateations
-- Read-only view, no data modifications

DROP VIEW IF EXISTS v_rateations_list_ui CASCADE;

CREATE VIEW v_rateations_list_ui AS
WITH r AS (
  SELECT
    id,
    owner_uid,
    number,
    tipo,
    taxpayer_name,
    status,
    is_pagopa,
    is_f24,
    type_id,
    created_at,
    updated_at,
    total_amount,
    paid_amount_cents,
    residual_amount_cents,
    overdue_amount_cents
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
  -- RQ link aggregation for PagoPA rateations
  SELECT
    l.pagopa_id,
    COUNT(*)::bigint as linked_rq_count,
    (
      SELECT rq.number
      FROM riam_quater_links l2
      JOIN rateations rq ON rq.id = l2.riam_quater_id
      WHERE l2.pagopa_id = l.pagopa_id
        AND l2.unlinked_at IS NULL
      ORDER BY l2.created_at DESC
      LIMIT 1
    ) as latest_linked_rq_number,
    (
      SELECT l2.riam_quater_id::bigint
      FROM riam_quater_links l2
      WHERE l2.pagopa_id = l.pagopa_id
        AND l2.unlinked_at IS NULL
      ORDER BY l2.created_at DESC
      LIMIT 1
    ) as latest_rq_id
  FROM riam_quater_links l
  WHERE l.unlinked_at IS NULL
  GROUP BY l.pagopa_id
)
SELECT
  r.id,
  r.owner_uid,
  r.number,
  r.tipo,
  r.taxpayer_name,
  r.status,
  r.is_pagopa,
  r.is_f24,
  r.type_id,
  r.created_at,
  r.updated_at,
  
  -- Monetary fields in cents (canonical)
  (r.total_amount * 100)::bigint as total_amount_cents,
  r.paid_amount_cents,
  r.residual_amount_cents as residual_effective_cents,
  r.overdue_amount_cents as overdue_effective_cents,
  
  -- Installment counters
  COALESCE(inst.installments_total, 0) as installments_total,
  COALESCE(inst.installments_paid, 0) as installments_paid,
  COALESCE(inst.installments_overdue_today, 0) as installments_overdue_today,
  
  -- Detect Quater from tipo field
  CASE 
    WHEN UPPER(COALESCE(r.tipo, '')) LIKE '%QUATER%' THEN true
    ELSE false
  END as is_quater,
  
  -- Quater fields (will be NULL for non-Quater rateations)
  NULL::bigint as original_total_due_cents,
  NULL::bigint as quater_total_due_cents,
  
  -- NEW: RQ link information for PagoPA rateations
  COALESCE(rq.linked_rq_count, 0) as linked_rq_count,
  rq.latest_linked_rq_number,
  rq.latest_rq_id
FROM r
LEFT JOIN inst ON inst.rateation_id = r.id
LEFT JOIN rq_links rq ON rq.pagopa_id = r.id;