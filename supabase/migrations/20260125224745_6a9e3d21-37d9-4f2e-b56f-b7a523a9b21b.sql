-- =====================================================
-- MIGRAZIONE: Correggere Classificazione F24 nelle RPC KPI
-- =====================================================
-- Logica corretta:
-- - F24 Attive: status IN (attiva, in_ritardo)
-- - F24 Completate: status = completata
-- - F24 Migrate: status = INTERROTTA (le interrotte sono migrate)
-- - F24 Decadute: status = DECADUTA (in attesa di essere agganciate)
-- Nota: Usiamo UPPER() per case-insensitivity

-- 1. get_kpi_due_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      -- Riam. Quater (priorità alta - prima di is_quater)
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE AND NOT (rt.name ILIKE '%riam%quater%') THEN 'Rottamazione Quater'
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      -- F24 Completate
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'COMPLETATA' THEN 'F24 Completate'
      -- F24 Migrate (status INTERROTTA = migrate a PagoPA)
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'INTERROTTA' THEN 'F24 Migrate'
      -- F24 Decadute (in attesa di essere agganciate)
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'DECADUTA' THEN 'F24 Decadute'
      -- F24 Attive
      WHEN r.is_f24 = TRUE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'F24'
      -- PagoPA Completate
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'COMPLETATA' THEN 'PagoPA Completate'
      -- PagoPA Interrotte (non migrate)
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'INTERROTTA' 
        AND NOT EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Interrotte'
      -- PagoPA Migrate RQ
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL) THEN 'PagoPA Migrate RQ'
      -- PagoPA Migrate R5
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL) THEN 'PagoPA Migrate R5'
      -- PagoPA Attive
      WHEN r.is_f24 = FALSE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND COALESCE(r.is_deleted, FALSE) = FALSE
    AND i.canceled_at IS NULL
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 2. get_kpi_paid_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE AND NOT (rt.name ILIKE '%riam%quater%') THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'COMPLETATA' THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'INTERROTTA' THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'DECADUTA' THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'F24'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'COMPLETATA' THEN 'PagoPA Completate'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'INTERROTTA' 
        AND NOT EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Interrotte'
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL) THEN 'PagoPA Migrate RQ'
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL) THEN 'PagoPA Migrate R5'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND COALESCE(r.is_deleted, FALSE) = FALSE
    AND i.canceled_at IS NULL
    AND i.is_paid = TRUE
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 3. get_kpi_residual_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE AND NOT (rt.name ILIKE '%riam%quater%') THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'COMPLETATA' THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'INTERROTTA' THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'DECADUTA' THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'F24'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'COMPLETATA' THEN 'PagoPA Completate'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'INTERROTTA' 
        AND NOT EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Interrotte'
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL) THEN 'PagoPA Migrate RQ'
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL) THEN 'PagoPA Migrate R5'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND COALESCE(r.is_deleted, FALSE) = FALSE
    AND i.canceled_at IS NULL
    AND COALESCE(i.is_paid, FALSE) = FALSE
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 4. get_kpi_overdue_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_overdue_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE AND NOT (rt.name ILIKE '%riam%quater%') THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'COMPLETATA' THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'INTERROTTA' THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) = 'DECADUTA' THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'F24'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'COMPLETATA' THEN 'PagoPA Completate'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) = 'INTERROTTA' 
        AND NOT EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Interrotte'
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL) THEN 'PagoPA Migrate RQ'
      WHEN r.is_f24 = FALSE AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL) THEN 'PagoPA Migrate R5'
      WHEN r.is_f24 = FALSE AND UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND COALESCE(r.is_deleted, FALSE) = FALSE
    AND i.canceled_at IS NULL
    AND i.is_paid = FALSE
    AND i.due_date < CURRENT_DATE
  GROUP BY type_label
  ORDER BY type_label;
$$;