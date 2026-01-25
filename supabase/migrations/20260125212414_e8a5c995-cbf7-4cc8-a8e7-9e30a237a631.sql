-- Fix CASE WHEN ordering bug in all 4 KPI functions
-- The issue: Quater/Quinquies conditions must come BEFORE the generic PagoPa condition
-- to avoid including Riam.Quater and Rottamazione Quater in PagoPa totals

-- 1. Fix get_kpi_due_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
        THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
        THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.decadence_reason ILIKE '%attesa%'
        THEN 'F24 In Attesa'
      WHEN r.is_f24 = TRUE
        THEN 'F24'
      -- PagoPA categories
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'PagoPA Completate'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'PagoPA Interrotte'
      -- FIXED: Quater/Quinquies BEFORE generic PagoPa
      WHEN r.is_quater = TRUE
        THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
        THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
        THEN 'Rottamazione Quinquies'
      -- Generic PagoPa (catch-all for non-F24 active)
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
        THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.is_deleted = FALSE
    AND r.owner_uid = auth.uid()
  GROUP BY 1
  HAVING COALESCE(SUM(i.amount_cents), 0) > 0;
$$;

-- 2. Fix get_kpi_paid_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
        THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
        THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.decadence_reason ILIKE '%attesa%'
        THEN 'F24 In Attesa'
      WHEN r.is_f24 = TRUE
        THEN 'F24'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'PagoPA Completate'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'PagoPA Interrotte'
      -- FIXED: Quater/Quinquies BEFORE generic PagoPa
      WHEN r.is_quater = TRUE
        THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
        THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
        THEN 'Rottamazione Quinquies'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
        THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(CASE WHEN i.is_paid THEN i.amount_cents ELSE 0 END), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.is_deleted = FALSE
    AND r.owner_uid = auth.uid()
  GROUP BY 1
  HAVING COALESCE(SUM(CASE WHEN i.is_paid THEN i.amount_cents ELSE 0 END), 0) > 0;
$$;

-- 3. Fix get_kpi_residual_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
        THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
        THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.decadence_reason ILIKE '%attesa%'
        THEN 'F24 In Attesa'
      WHEN r.is_f24 = TRUE
        THEN 'F24'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'PagoPA Completate'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'PagoPA Interrotte'
      -- FIXED: Quater/Quinquies BEFORE generic PagoPa
      WHEN r.is_quater = TRUE
        THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
        THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
        THEN 'Rottamazione Quinquies'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
        THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(CASE WHEN NOT COALESCE(i.is_paid, FALSE) THEN i.amount_cents ELSE 0 END), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.is_deleted = FALSE
    AND r.owner_uid = auth.uid()
  GROUP BY 1
  HAVING COALESCE(SUM(CASE WHEN NOT COALESCE(i.is_paid, FALSE) THEN i.amount_cents ELSE 0 END), 0) > 0;
$$;

-- 4. Fix get_kpi_overdue_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_overdue_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'F24 Completate'
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
        THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
        THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.decadence_reason ILIKE '%attesa%'
        THEN 'F24 In Attesa'
      WHEN r.is_f24 = TRUE
        THEN 'F24'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'completata'
        THEN 'PagoPA Completate'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL)
        THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
        THEN 'PagoPA Interrotte'
      -- FIXED: Quater/Quinquies BEFORE generic PagoPa
      WHEN r.is_quater = TRUE
        THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
        THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
        THEN 'Rottamazione Quinquies'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
        THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(
      CASE 
        WHEN NOT COALESCE(i.is_paid, FALSE) AND i.due_date < CURRENT_DATE 
        THEN i.amount_cents 
        ELSE 0 
      END
    ), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.is_deleted = FALSE
    AND r.owner_uid = auth.uid()
  GROUP BY 1
  HAVING COALESCE(SUM(
    CASE 
      WHEN NOT COALESCE(i.is_paid, FALSE) AND i.due_date < CURRENT_DATE 
      THEN i.amount_cents 
      ELSE 0 
    END
  ), 0) > 0;
$$;