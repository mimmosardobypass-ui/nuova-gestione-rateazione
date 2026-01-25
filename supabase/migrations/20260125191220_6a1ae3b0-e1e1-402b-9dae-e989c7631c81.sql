-- Aggiornamento delle 4 funzioni RPC KPI per categorizzazione granulare F24 e PagoPA

-- 1. get_kpi_due_by_type - Totale DOVUTO per tipo
CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      -- F24 COMPLETATE (priorità 1)
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'F24 Completate'
      -- F24 MIGRATE (priorità 2 - ha link verso PagoPA)
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      -- F24 IN ATTESA (priorità 3 - decadute senza link)
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      -- F24 ATTIVE (priorità 4)
      WHEN r.is_f24 = TRUE
      THEN 'F24'
      -- PAGOPA COMPLETATE
      WHEN rt.name ILIKE '%pagopa%' AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'PagoPA Completate'
      -- PAGOPA MIGRATE A RQ
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate RQ'
      -- PAGOPA MIGRATE A R5
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate R5'
      -- PAGOPA ATTIVE
      WHEN rt.name ILIKE '%pagopa%'
      THEN 'PagoPa'
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%'
      THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(
      CASE
        WHEN r.is_quater = TRUE THEN COALESCE(r.quater_total_due_cents, 0)
        ELSE COALESCE(r.total_amount, 0) * 100
      END
    ), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND LOWER(COALESCE(r.status, '')) NOT IN ('estinta')
    -- Esclude PagoPA interrotte senza link (non sono più impegni)
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      AND NOT EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
    )
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 2. get_kpi_paid_by_type - Totale PAGATO per tipo
CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      -- F24 COMPLETATE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'F24 Completate'
      -- F24 MIGRATE
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      -- F24 IN ATTESA
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      -- F24 ATTIVE
      WHEN r.is_f24 = TRUE
      THEN 'F24'
      -- PAGOPA COMPLETATE
      WHEN rt.name ILIKE '%pagopa%' AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'PagoPA Completate'
      -- PAGOPA MIGRATE A RQ
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate RQ'
      -- PAGOPA MIGRATE A R5
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate R5'
      -- PAGOPA ATTIVE
      WHEN rt.name ILIKE '%pagopa%'
      THEN 'PagoPa'
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%'
      THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(COALESCE(r.paid_amount_cents, 0)), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND LOWER(COALESCE(r.status, '')) NOT IN ('estinta')
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      AND NOT EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
    )
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 3. get_kpi_residual_by_type - RESIDUO per tipo
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      -- F24 COMPLETATE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'F24 Completate'
      -- F24 MIGRATE
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      -- F24 IN ATTESA
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      -- F24 ATTIVE
      WHEN r.is_f24 = TRUE
      THEN 'F24'
      -- PAGOPA COMPLETATE
      WHEN rt.name ILIKE '%pagopa%' AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'PagoPA Completate'
      -- PAGOPA MIGRATE A RQ
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate RQ'
      -- PAGOPA MIGRATE A R5
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate R5'
      -- PAGOPA ATTIVE
      WHEN rt.name ILIKE '%pagopa%'
      THEN 'PagoPa'
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%'
      THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(COALESCE(r.residual_amount_cents, 0)), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND LOWER(COALESCE(r.status, '')) NOT IN ('estinta')
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      AND NOT EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
    )
  GROUP BY type_label
  ORDER BY type_label;
$$;

-- 4. get_kpi_overdue_by_type - IN RITARDO per tipo
CREATE OR REPLACE FUNCTION public.get_kpi_overdue_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      -- F24 COMPLETATE
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'F24 Completate'
      -- F24 MIGRATE
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      -- F24 IN ATTESA
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      -- F24 ATTIVE
      WHEN r.is_f24 = TRUE
      THEN 'F24'
      -- PAGOPA COMPLETATE
      WHEN rt.name ILIKE '%pagopa%' AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'PagoPA Completate'
      -- PAGOPA MIGRATE A RQ
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate RQ'
      -- PAGOPA MIGRATE A R5
      WHEN rt.name ILIKE '%pagopa%' AND EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      THEN 'PagoPA Migrate R5'
      -- PAGOPA ATTIVE
      WHEN rt.name ILIKE '%pagopa%'
      THEN 'PagoPa'
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%'
      THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(COALESCE(r.overdue_amount_cents, 0)), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND LOWER(COALESCE(r.status, '')) NOT IN ('estinta')
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      AND NOT EXISTS (SELECT 1 FROM riam_quater_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM quinquies_links l WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL)
    )
  GROUP BY type_label
  ORDER BY type_label;
$$;