-- Fix: Separare Rottamazione Quater e Riammissione Quater nelle RPC KPI
-- Il pattern %riam%quater% deve essere controllato PRIMA di is_quater = TRUE

-- 1) get_kpi_due_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- F24 categories (priority order)
      WHEN r.status = 'completata' AND r.is_f24 = TRUE THEN 'F24 Completate'
      WHEN r.status = 'interrotta' AND r.is_f24 = TRUE THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (
        SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id
      ) THEN 'F24 Migrate'
      WHEN r.status = 'DECADUTA' AND r.is_f24 = TRUE THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.status IN ('attiva', 'in_ritardo') THEN 'F24'
      
      -- PagoPA categories (priority order)
      WHEN r.status = 'completata' AND r.is_f24 = FALSE THEN 'PagoPA Completate'
      WHEN EXISTS (
        SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate RQ'
      WHEN EXISTS (
        SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate R5'
      
      -- Rottamazioni: PRIMA controllare il nome per Riammissione, POI il flag is_quater
      WHEN t.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      WHEN r.is_f24 = FALSE AND r.status IN ('attiva', 'in_ritardo') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 2) get_kpi_paid_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN r.status = 'completata' AND r.is_f24 = TRUE THEN 'F24 Completate'
      WHEN r.status = 'interrotta' AND r.is_f24 = TRUE THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (
        SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id
      ) THEN 'F24 Migrate'
      WHEN r.status = 'DECADUTA' AND r.is_f24 = TRUE THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.status IN ('attiva', 'in_ritardo') THEN 'F24'
      
      WHEN r.status = 'completata' AND r.is_f24 = FALSE THEN 'PagoPA Completate'
      WHEN EXISTS (
        SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate RQ'
      WHEN EXISTS (
        SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate R5'
      
      -- Fix: controllare nome PRIMA di is_quater
      WHEN t.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      WHEN r.is_f24 = FALSE AND r.status IN ('attiva', 'in_ritardo') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(
      CASE WHEN i.is_paid = TRUE THEN i.amount_cents ELSE 0 END
    ), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 3) get_kpi_residual_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN r.status = 'completata' AND r.is_f24 = TRUE THEN 'F24 Completate'
      WHEN r.status = 'interrotta' AND r.is_f24 = TRUE THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (
        SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id
      ) THEN 'F24 Migrate'
      WHEN r.status = 'DECADUTA' AND r.is_f24 = TRUE THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.status IN ('attiva', 'in_ritardo') THEN 'F24'
      
      WHEN r.status = 'completata' AND r.is_f24 = FALSE THEN 'PagoPA Completate'
      WHEN EXISTS (
        SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate RQ'
      WHEN EXISTS (
        SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate R5'
      
      -- Fix: controllare nome PRIMA di is_quater
      WHEN t.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      WHEN r.is_f24 = FALSE AND r.status IN ('attiva', 'in_ritardo') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(
      CASE WHEN i.is_paid = FALSE OR i.is_paid IS NULL THEN i.amount_cents ELSE 0 END
    ), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 4) get_kpi_overdue_by_type
CREATE OR REPLACE FUNCTION public.get_kpi_overdue_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN r.status = 'completata' AND r.is_f24 = TRUE THEN 'F24 Completate'
      WHEN r.status = 'interrotta' AND r.is_f24 = TRUE THEN 'F24 Interrotte'
      WHEN r.is_f24 = TRUE AND EXISTS (
        SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id
      ) THEN 'F24 Migrate'
      WHEN r.status = 'DECADUTA' AND r.is_f24 = TRUE THEN 'F24 Decadute'
      WHEN r.is_f24 = TRUE AND r.status IN ('attiva', 'in_ritardo') THEN 'F24'
      
      WHEN r.status = 'completata' AND r.is_f24 = FALSE THEN 'PagoPA Completate'
      WHEN EXISTS (
        SELECT 1 FROM riam_quater_links rql WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate RQ'
      WHEN EXISTS (
        SELECT 1 FROM quinquies_links ql WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      ) THEN 'PagoPA Migrate R5'
      
      -- Fix: controllare nome PRIMA di is_quater
      WHEN t.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      WHEN r.is_f24 = FALSE AND r.status IN ('attiva', 'in_ritardo') THEN 'PagoPa'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(
      CASE 
        WHEN (i.is_paid = FALSE OR i.is_paid IS NULL) 
          AND i.due_date < CURRENT_DATE 
        THEN i.amount_cents 
        ELSE 0 
      END
    ), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY type_label
  ORDER BY type_label;
$$;