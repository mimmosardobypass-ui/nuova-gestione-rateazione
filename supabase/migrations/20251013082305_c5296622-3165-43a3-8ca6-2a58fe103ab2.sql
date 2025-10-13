-- ========================================
-- SOFT-DELETE VIEWS: Bulk Update (Migration 3/3) - FIXED
-- Aggiorna view KPI, dashboard, allocazioni, link
-- ========================================

-- 4. v_rateations_with_kpis (KPI Dashboard) - FIXED: no duplicate columns
DROP VIEW IF EXISTS public.v_rateations_with_kpis CASCADE;

CREATE VIEW public.v_rateations_with_kpis AS
SELECT
  r.*,
  COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.is_paid = FALSE
  ), 0) AS residual_amount_cents_calc,
  COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.is_paid = FALSE AND i.due_date < CURRENT_DATE
  ), 0) AS overdue_amount_cents_calc,
  COALESCE((
    SELECT COUNT(*)
    FROM installments i
    WHERE i.rateation_id = r.id
  ), 0) AS rate_totali,
  COALESCE((
    SELECT COUNT(*)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.is_paid = TRUE
  ), 0) AS rate_pagate,
  COALESCE((
    SELECT COUNT(*)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.is_paid = FALSE AND i.due_date < CURRENT_DATE
  ), 0) AS rate_in_ritardo,
  COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.due_date = CURRENT_DATE AND i.is_paid = FALSE
  ), 0) AS due_today_cents,
  COALESCE((
    SELECT COUNT(*)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.due_date = CURRENT_DATE AND i.is_paid = FALSE
  ), 0) AS unpaid_due_today,
  COALESCE((
    SELECT COUNT(*)
    FROM installments i
    WHERE i.rateation_id = r.id AND i.is_paid = FALSE AND i.due_date < CURRENT_DATE
  ), 0) AS unpaid_overdue_today,
  EXISTS(
    SELECT 1 FROM rateation_types rt 
    WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
  ) AS is_pagopa,
  CASE 
    WHEN r.status = 'INTERROTTA' THEN COALESCE(r.residual_at_interruption_cents, 0)
    ELSE COALESCE((
      SELECT SUM(i.amount_cents)
      FROM installments i
      WHERE i.rateation_id = r.id AND i.is_paid = FALSE
    ), 0)
  END AS residual_effective_cents,
  CASE 
    WHEN r.status = 'INTERROTTA' THEN COALESCE(r.overdue_at_interruption_cents, 0)
    ELSE COALESCE((
      SELECT SUM(i.amount_cents)
      FROM installments i
      WHERE i.rateation_id = r.id AND i.is_paid = FALSE AND i.due_date < CURRENT_DATE
    ), 0)
  END AS overdue_effective_cents
FROM public.rateations r
WHERE COALESCE(r.is_deleted, FALSE) = FALSE;  -- ⬅️ FILTRO SOFT-DELETE

-- 5. v_kpi_rateations_effective (KPI Residual Effective)
DROP VIEW IF EXISTS public.v_kpi_rateations_effective CASCADE;

CREATE VIEW public.v_kpi_rateations_effective AS
SELECT
  SUM(
    CASE 
      WHEN r.status = 'INTERROTTA' THEN COALESCE(r.residual_at_interruption_cents, 0)
      ELSE COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.rateation_id = r.id AND i.is_paid = FALSE
      ), 0)
    END
  ) AS effective_residual_amount_cents
FROM public.rateations r
WHERE COALESCE(r.is_deleted, FALSE) = FALSE  -- ⬅️ FILTRO SOFT-DELETE
  AND r.owner_uid = auth.uid();

-- 6. v_kpi_rateations_overdue_effective (KPI Overdue Effective)
DROP VIEW IF EXISTS public.v_kpi_rateations_overdue_effective CASCADE;

CREATE VIEW public.v_kpi_rateations_overdue_effective AS
SELECT
  SUM(
    CASE 
      WHEN r.status = 'INTERROTTA' THEN COALESCE(r.overdue_at_interruption_cents, 0)
      ELSE COALESCE((
        SELECT SUM(i.amount_cents)
        FROM installments i
        WHERE i.rateation_id = r.id AND i.is_paid = FALSE AND i.due_date < CURRENT_DATE
      ), 0)
    END
  ) AS effective_overdue_amount_cents
FROM public.rateations r
WHERE COALESCE(r.is_deleted, FALSE) = FALSE  -- ⬅️ FILTRO SOFT-DELETE
  AND r.owner_uid = auth.uid();

-- 7. v_rateation_type_label (Type label mapping)
DROP VIEW IF EXISTS public.v_rateation_type_label CASCADE;

CREATE VIEW public.v_rateation_type_label AS
SELECT
  r.id,
  r.owner_uid,
  r.type_id,
  rt.name AS tipo,
  CASE 
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%F24%' THEN 'F24'
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%' THEN 'PagoPA'
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%ROTTAMAZIONE%QUATER%' THEN 'Rottamazione Quater'
    WHEN UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%QUATER%' OR UPPER(COALESCE(rt.name, '')) LIKE '%RIAMMISSIONE%QUATER%' THEN 'Riam. Quater'
    ELSE 'Altro'
  END AS type_label,
  EXISTS(
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) AS is_pagopa
FROM public.rateations r
LEFT JOIN public.rateation_types rt ON rt.id = r.type_id
WHERE COALESCE(r.is_deleted, FALSE) = FALSE;  -- ⬅️ FILTRO SOFT-DELETE

-- 8. v_pagopa_allocations (Allocazioni PagoPA)
DROP VIEW IF EXISTS public.v_pagopa_allocations CASCADE;

CREATE VIEW public.v_pagopa_allocations AS
WITH pagopa_residual AS (
  SELECT
    r.id AS pagopa_id,
    r.owner_uid,
    r.number AS pagopa_number,
    r.taxpayer_name,
    COALESCE(r.residual_amount_cents, 0) AS residual_cents
  FROM public.rateations r
  WHERE COALESCE(r.is_deleted, FALSE) = FALSE  -- ⬅️ FILTRO SOFT-DELETE
    AND EXISTS(
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    )
),
link_totals AS (
  SELECT
    l.pagopa_id,
    COALESCE(SUM(l.allocated_residual_cents), 0) AS allocated_cents
  FROM public.riam_quater_links l
  WHERE l.unlinked_at IS NULL
  GROUP BY l.pagopa_id
)
SELECT
  p.pagopa_id,
  p.owner_uid,
  p.pagopa_number,
  p.taxpayer_name,
  p.residual_cents,
  COALESCE(lt.allocated_cents, 0) AS allocated_cents,
  GREATEST(0, p.residual_cents - COALESCE(lt.allocated_cents, 0)) AS allocatable_cents,
  EXISTS(
    SELECT 1 FROM riam_quater_links l 
    WHERE l.pagopa_id = p.pagopa_id AND l.unlinked_at IS NULL
  ) AS has_links
FROM pagopa_residual p
LEFT JOIN link_totals lt ON lt.pagopa_id = p.pagopa_id;

-- 9. v_migrable_pagopa (PagoPA migrabili)
DROP VIEW IF EXISTS public.v_migrable_pagopa CASCADE;

CREATE VIEW public.v_migrable_pagopa AS
SELECT
  r.id,
  r.number,
  r.taxpayer_name,
  r.status,
  r.total_amount,
  r.interrupted_by_rateation_id,
  COALESCE(r.residual_amount_cents, 0) - COALESCE((
    SELECT SUM(l.allocated_residual_cents)
    FROM riam_quater_links l
    WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL
  ), 0) AS allocatable_cents
FROM public.rateations r
WHERE COALESCE(r.is_deleted, FALSE) = FALSE  -- ⬅️ FILTRO SOFT-DELETE
  AND r.owner_uid = auth.uid()
  AND EXISTS(
    SELECT 1 FROM rateation_types rt 
    WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
  );

-- 10. v_quater_saving_per_user (Risparmio Quater)
DROP VIEW IF EXISTS public.v_quater_saving_per_user CASCADE;

CREATE VIEW public.v_quater_saving_per_user AS
SELECT
  r.owner_uid,
  SUM(COALESCE(r.original_total_due_cents, 0) - COALESCE(r.quater_total_due_cents, 0)) / 100.0 AS saving_eur
FROM public.rateations r
WHERE COALESCE(r.is_deleted, FALSE) = FALSE  -- ⬅️ FILTRO SOFT-DELETE
  AND r.is_quater = TRUE
GROUP BY r.owner_uid;

-- Commenti documentazione
COMMENT ON VIEW public.v_rateations_with_kpis IS 'Rateations with calculated KPIs - filters soft-deleted (is_deleted=false)';
COMMENT ON VIEW public.v_kpi_rateations_effective IS 'Effective residual KPI - filters soft-deleted (is_deleted=false)';
COMMENT ON VIEW public.v_kpi_rateations_overdue_effective IS 'Effective overdue KPI - filters soft-deleted (is_deleted=false)';
COMMENT ON VIEW public.v_rateation_type_label IS 'Type label mapping - filters soft-deleted (is_deleted=false)';
COMMENT ON VIEW public.v_pagopa_allocations IS 'PagoPA allocations - filters soft-deleted (is_deleted=false)';
COMMENT ON VIEW public.v_migrable_pagopa IS 'Migrable PagoPA - filters soft-deleted (is_deleted=false)';
COMMENT ON VIEW public.v_quater_saving_per_user IS 'Quater savings per user - filters soft-deleted (is_deleted=false)';