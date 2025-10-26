-- Normalize status in v_rateations_list_ui to treat 'in_ritardo' as 'attiva'
-- Aligns with v_rateations_stats_v3 logic for consistency

DROP VIEW IF EXISTS v_rateations_list_ui;

CREATE VIEW v_rateations_list_ui AS
WITH inst AS (
  SELECT 
    i.rateation_id,
    COUNT(*) AS installments_total,
    COUNT(*) FILTER (WHERE i.is_paid = TRUE) AS installments_paid,
    COUNT(*) FILTER (
      WHERE i.is_paid = FALSE 
        AND i.canceled_at IS NULL 
        AND i.due_date < CURRENT_DATE
    ) AS installments_overdue_today,
    MIN(i.due_date) FILTER (
      WHERE i.is_paid = FALSE 
        AND i.canceled_at IS NULL
        AND i.due_date >= CURRENT_DATE
    ) AS f24_next_due_date
  FROM installments i
  WHERE i.canceled_at IS NULL
  GROUP BY i.rateation_id
),
rq_links AS (
  SELECT 
    rql.pagopa_id,
    COUNT(*) AS linked_rq_count,
    MAX(rql.riam_quater_id) AS latest_rq_id,
    SUM(rql.allocated_residual_cents) AS allocated_residual_cents,
    MAX(rql.rq_total_at_link_cents) AS rq_total_at_link_cents
  FROM riam_quater_links rql
  WHERE rql.unlinked_at IS NULL
  GROUP BY rql.pagopa_id
),
rq_numbers AS (
  SELECT 
    rql.pagopa_id,
    r.number AS latest_linked_rq_number
  FROM riam_quater_links rql
  INNER JOIN rateations r ON r.id = rql.riam_quater_id
  WHERE rql.unlinked_at IS NULL
    AND rql.riam_quater_id = (
      SELECT MAX(rql2.riam_quater_id)
      FROM riam_quater_links rql2
      WHERE rql2.pagopa_id = rql.pagopa_id
        AND rql2.unlinked_at IS NULL
    )
)
SELECT
  r.id,
  r.owner_uid,
  r.number,
  rt.name AS tipo,
  r.taxpayer_name,
  
  -- Normalize status: treat 'in_ritardo' as 'attiva'
  CASE
    WHEN UPPER(COALESCE(r.status, 'attiva')) = 'INTERROTTA' THEN 'interrotta'
    WHEN LOWER(COALESCE(r.status, 'attiva')) IN ('in_ritardo', 'attiva') THEN 'attiva'
    ELSE LOWER(COALESCE(r.status, 'attiva'))
  END AS status,
  
  CASE 
    WHEN rt.name IN ('PagoPA', 'PagoPa Semplificato', 'PagoPa [Semplificato]', 'Rateazione PagoPA', 'PagoPa [Avviso PagoPA]') 
    THEN TRUE 
    ELSE FALSE 
  END AS is_pagopa,
  r.is_f24,
  r.is_quater,
  r.type_id,
  r.created_at,
  r.updated_at,
  
  -- Interruption fields
  r.interruption_reason,
  r.interrupted_at,
  r.interrupted_by_rateation_id,

  -- Monetary fields in cents (canonical source)
  COALESCE(r.total_amount, 0) * 100 AS total_amount_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_effective_cents,
  COALESCE(r.overdue_amount_cents, 0) AS overdue_effective_cents,

  -- Installment counters
  COALESCE(inst.installments_total, 0) AS installments_total,
  COALESCE(inst.installments_paid, 0) AS installments_paid,
  COALESCE(inst.installments_overdue_today, 0) AS installments_overdue_today,

  -- Quater fields (in cents)
  r.original_total_due_cents,
  r.quater_total_due_cents,
  
  -- RQ allocation fields
  rq_links.allocated_residual_cents,
  rq_links.rq_total_at_link_cents,
  
  -- RQ link fields
  COALESCE(rq_links.linked_rq_count, 0) AS linked_rq_count,
  rq_numbers.latest_linked_rq_number,
  rq_links.latest_rq_id,

  -- F24 Recovery Window field
  CASE 
    WHEN r.is_f24 = TRUE AND inst.f24_next_due_date IS NOT NULL 
    THEN (inst.f24_next_due_date - CURRENT_DATE)::integer
    ELSE NULL
  END AS f24_days_to_next_due

FROM rateations r
INNER JOIN rateation_types rt ON rt.id = r.type_id
LEFT JOIN inst ON inst.rateation_id = r.id
LEFT JOIN rq_links ON rq_links.pagopa_id = r.id
LEFT JOIN rq_numbers ON rq_numbers.pagopa_id = r.id
WHERE r.is_deleted = FALSE;

GRANT SELECT ON v_rateations_list_ui TO authenticated;