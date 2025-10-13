-- ========================================
-- SOFT-DELETE VIEWS: UI-Critical (Migration 2/3)
-- Aggiorna le 3 view principali per filtrare soft-deleted
-- ========================================

-- 1. v_rateations_list_ui (CRITICA - Lista principale UI)
DROP VIEW IF EXISTS public.v_rateations_list_ui CASCADE;

CREATE VIEW public.v_rateations_list_ui AS
WITH
r AS (
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
    rt.name as tipo,
    COALESCE(
      EXISTS (
        SELECT 1 FROM rateation_types rt2 
        WHERE rt2.id = ra.type_id 
        AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
      ), 
      FALSE
    ) AS is_pagopa
  FROM public.rateations ra
  LEFT JOIN public.rateation_types rt ON rt.id = ra.type_id
  WHERE COALESCE(ra.is_deleted, FALSE) = FALSE  -- ⬅️ FILTRO SOFT-DELETE
),
inst AS (
  SELECT
    i.rateation_id,
    SUM(COALESCE(i.amount, 0) * 100)::bigint AS total_amount_cents,
    SUM(CASE 
      WHEN i.is_paid = TRUE 
      THEN COALESCE(i.paid_total_cents, i.amount * 100, 0) 
      ELSE 0 
    END)::bigint AS paid_amount_cents,
    SUM(CASE
      WHEN i.due_date < CURRENT_DATE AND i.is_paid = FALSE
      THEN COALESCE(i.amount, 0) * 100
      ELSE 0
    END)::bigint AS overdue_effective_cents,
    COUNT(*) AS installments_total,
    COUNT(*) FILTER (WHERE i.is_paid = TRUE) AS installments_paid,
    COUNT(*) FILTER (
      WHERE i.due_date < CURRENT_DATE AND i.is_paid = FALSE
    ) AS installments_overdue_today
  FROM public.installments i
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
  FROM public.riam_quater_links l
  LEFT JOIN public.rateations rq ON rq.id = l.riam_quater_id
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
  COALESCE(inst.total_amount_cents, 0) AS total_amount_cents,
  COALESCE(inst.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(inst.overdue_effective_cents, 0) AS overdue_effective_cents,
  GREATEST(0, COALESCE(inst.total_amount_cents, 0) - 
              COALESCE(inst.paid_amount_cents, 0)) AS residual_effective_cents,
  COALESCE(inst.installments_total, 0) AS installments_total,
  COALESCE(inst.installments_paid, 0) AS installments_paid,
  COALESCE(inst.installments_overdue_today, 0) AS installments_overdue_today,
  COALESCE(rl.linked_rq_count, 0) AS linked_rq_count,
  rl.latest_linked_rq_number,
  rl.latest_rq_id,
  COALESCE(rl.allocated_residual_cents, 0) AS allocated_residual_cents,
  rl.rq_total_at_link_cents
FROM r
LEFT JOIN inst ON inst.rateation_id = r.id
LEFT JOIN rq_links rl ON rl.pagopa_id = r.id;

GRANT SELECT ON public.v_rateations_list_ui TO authenticated;

-- 2. v_rateations_stats_source (CRITICA - Stats V1)
DROP VIEW IF EXISTS public.v_rateations_stats_source CASCADE;

CREATE VIEW public.v_rateations_stats_source AS
SELECT
  r.id,
  rt.name AS type,
  LOWER(COALESCE(r.status, 'attiva')) AS status,
  COALESCE(r.paid_amount_cents, 0) + COALESCE(r.residual_amount_cents, 0) AS total_amount_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_amount_cents,
  COALESCE(r.overdue_amount_cents, 0) AS overdue_amount_cents,
  r.taxpayer_name,
  r.owner_uid,
  r.created_at
FROM public.rateations r
JOIN public.rateation_types rt ON rt.id = r.type_id
WHERE COALESCE(r.is_deleted, FALSE) = FALSE;  -- ⬅️ FILTRO SOFT-DELETE

-- 3. v_rateations_stats_source_v2 (CRITICA - Stats V2)
DROP VIEW IF EXISTS public.v_rateations_stats_source_v2 CASCADE;

CREATE VIEW public.v_rateations_stats_source_v2 AS
SELECT
  r.id,
  CASE 
    WHEN rt.name ILIKE '%F24%' THEN 'F24'
    WHEN rt.name ILIKE '%PAGOPA%' THEN 'PAGOPA'
    WHEN rt.name ILIKE '%ROTTAMAZIONE%QUATER%' THEN 'ROTTAMAZIONE_QUATER'
    WHEN rt.name ILIKE '%RIAM%QUATER%' OR rt.name ILIKE '%RIAMMISSIONE%QUATER%' THEN 'RIAMMISSIONE_QUATER'
    ELSE 'ALTRO'
  END AS type,
  LOWER(COALESCE(r.status, 'attiva')) AS status,
  COALESCE((r.total_amount * 100)::bigint, 0) AS total_amount_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_amount_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_amount_cents,
  r.taxpayer_name,
  r.owner_uid AS owner_id,
  r.created_at,
  COALESCE(r.start_due_date, r.created_at::date) AS ref_date
FROM public.rateations r
LEFT JOIN public.rateation_types rt ON rt.id = r.type_id
WHERE COALESCE(r.is_deleted, FALSE) = FALSE;  -- ⬅️ FILTRO SOFT-DELETE

-- Commenti documentazione
COMMENT ON VIEW public.v_rateations_list_ui IS 'Main UI list view - filters out soft-deleted rateations (is_deleted=false)';
COMMENT ON VIEW public.v_rateations_stats_source IS 'Stats V1 source - filters out soft-deleted rateations (is_deleted=false)';
COMMENT ON VIEW public.v_rateations_stats_source_v2 IS 'Stats V2 source - filters out soft-deleted rateations (is_deleted=false)';