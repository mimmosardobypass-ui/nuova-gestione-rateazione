CREATE OR REPLACE VIEW v_rateations_list_ui AS
WITH inst AS (
  SELECT i.rateation_id,
    count(*) AS installments_total,
    count(*) FILTER (WHERE i.is_paid = true) AS installments_paid,
    count(*) FILTER (WHERE i.is_paid = false AND i.canceled_at IS NULL AND i.due_date < CURRENT_DATE) AS installments_overdue_today,
    min(i.due_date) FILTER (WHERE i.is_paid = false AND i.canceled_at IS NULL AND i.due_date >= CURRENT_DATE) AS f24_next_due_date
  FROM installments i
  WHERE i.canceled_at IS NULL
  GROUP BY i.rateation_id
), rq_links AS (
  SELECT rql.pagopa_id,
    count(*) AS linked_rq_count,
    max(rql.riam_quater_id) AS latest_rq_id,
    sum(rql.allocated_residual_cents) AS allocated_residual_cents,
    max(rql.rq_total_at_link_cents) AS rq_total_at_link_cents
  FROM riam_quater_links rql
  WHERE rql.unlinked_at IS NULL
  GROUP BY rql.pagopa_id
), rq_numbers AS (
  SELECT rql.pagopa_id,
    r_1.number AS latest_linked_rq_number
  FROM riam_quater_links rql
    JOIN rateations r_1 ON r_1.id = rql.riam_quater_id
  WHERE rql.unlinked_at IS NULL AND rql.riam_quater_id = (
    SELECT max(rql2.riam_quater_id)
    FROM riam_quater_links rql2
    WHERE rql2.pagopa_id = rql.pagopa_id AND rql2.unlinked_at IS NULL
  )
), r5_links AS (
  SELECT ql.pagopa_id,
    count(*) AS linked_r5_count,
    max(ql.quinquies_id) AS latest_r5_id
  FROM quinquies_links ql
  WHERE ql.unlinked_at IS NULL
  GROUP BY ql.pagopa_id
), r5_numbers AS (
  SELECT ql.pagopa_id,
    r_1.number AS latest_linked_r5_number
  FROM quinquies_links ql
    JOIN rateations r_1 ON r_1.id = ql.quinquies_id
  WHERE ql.unlinked_at IS NULL AND ql.quinquies_id = (
    SELECT max(ql2.quinquies_id)
    FROM quinquies_links ql2
    WHERE ql2.pagopa_id = ql.pagopa_id AND ql2.unlinked_at IS NULL
  )
)
SELECT r.id,
  r.owner_uid,
  r.number,
  rt.name AS tipo,
  r.taxpayer_name,
  CASE
    WHEN upper(COALESCE(r.status, 'attiva'::text)) = 'INTERROTTA'::text THEN 'interrotta'::text
    WHEN lower(COALESCE(r.status, 'attiva'::text)) = ANY (ARRAY['in_ritardo'::text, 'attiva'::text]) THEN 'attiva'::text
    ELSE lower(COALESCE(r.status, 'attiva'::text))
  END AS status,
  CASE
    WHEN rt.name = ANY (ARRAY['PagoPA'::text, 'PagoPa Semplificato'::text, 'PagoPa [Semplificato]'::text, 'Rateazione PagoPA'::text, 'PagoPa [Avviso PagoPA]'::text]) THEN true
    ELSE false
  END AS is_pagopa,
  r.is_f24,
  r.is_quater,
  r.type_id,
  r.created_at,
  r.updated_at,
  r.interruption_reason,
  r.interrupted_at,
  r.interrupted_by_rateation_id,
  COALESCE(r.total_amount, 0::numeric) * 100::numeric AS total_amount_cents,
  COALESCE(r.paid_amount_cents, 0::bigint) AS paid_amount_cents,
  COALESCE(r.residual_amount_cents, 0::bigint) AS residual_effective_cents,
  COALESCE(r.overdue_amount_cents, 0::bigint) AS overdue_effective_cents,
  COALESCE(inst.installments_total, 0::bigint) AS installments_total,
  COALESCE(inst.installments_paid, 0::bigint) AS installments_paid,
  COALESCE(inst.installments_overdue_today, 0::bigint) AS installments_overdue_today,
  r.original_total_due_cents,
  r.quater_total_due_cents,
  rq_links.allocated_residual_cents,
  rq_links.rq_total_at_link_cents,
  COALESCE(rq_links.linked_rq_count, 0::bigint) AS linked_rq_count,
  rq_numbers.latest_linked_rq_number,
  rq_links.latest_rq_id,
  CASE
    WHEN r.is_f24 = true AND inst.f24_next_due_date IS NOT NULL THEN inst.f24_next_due_date - CURRENT_DATE
    ELSE NULL::integer
  END AS f24_days_to_next_due,
  COALESCE(r5_links.linked_r5_count, 0::bigint) AS linked_r5_count,
  r5_numbers.latest_linked_r5_number,
  r5_links.latest_r5_id
FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  LEFT JOIN inst ON inst.rateation_id = r.id
  LEFT JOIN rq_links ON rq_links.pagopa_id = r.id
  LEFT JOIN rq_numbers ON rq_numbers.pagopa_id = r.id
  LEFT JOIN r5_links ON r5_links.pagopa_id = r.id
  LEFT JOIN r5_numbers ON r5_numbers.pagopa_id = r.id
WHERE r.is_deleted = false;