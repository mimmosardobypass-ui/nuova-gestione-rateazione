-- Aggiorna get_kpi_due_by_type per includere F24 Decadute e F24 Interrotte
CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    CASE
      -- F24 COMPLETATE (priorità 1)
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'F24 Completate'
      
      -- F24 INTERROTTE (priorità 2)
      WHEN r.is_f24 = TRUE AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      THEN 'F24 Interrotte'
      
      -- F24 MIGRATE (priorità 3 - ha link verso PagoPA)
      WHEN r.is_f24 = TRUE AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      
      -- F24 DECADUTE (priorità 4 - decadute senza link)
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 Decadute'
      
      -- F24 IN ATTESA (priorità 5 - decadute con In Attesa nel reason)
      WHEN r.is_f24 = TRUE AND r.decadence_reason ILIKE '%attesa%'
      THEN 'F24 In Attesa'
      
      -- F24 ATTIVE (priorità 6)
      WHEN r.is_f24 = TRUE
      THEN 'F24'
      
      -- PagoPA COMPLETATE
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'completata'
      THEN 'PagoPA Completate'
      
      -- PagoPA MIGRATE RQ
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM riam_quater_links rql 
        WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate RQ'
      
      -- PagoPA MIGRATE R5
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM quinquies_links ql 
        WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate R5'
      
      -- PagoPA Interrotte
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      THEN 'PagoPA Interrotte'
      
      -- PagoPA ATTIVE
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
      THEN 'PagoPa'
      
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      
      -- Riammissione Quater
      WHEN t.name ILIKE '%riammissione%quater%'
      THEN 'Riammissione Quater'
      
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id AND i.canceled_at IS NULL
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(i.amount_cents), 0) > 0;
$$;

-- Aggiorna get_kpi_paid_by_type per includere F24 Decadute e F24 Interrotte
CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM riam_quater_links rql 
        WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM quinquies_links ql 
        WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      THEN 'PagoPA Interrotte'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
      THEN 'PagoPa'
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
      THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id 
    AND i.canceled_at IS NULL
    AND i.is_paid = TRUE
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(i.amount_cents), 0) > 0;
$$;

-- Aggiorna get_kpi_residual_by_type per includere F24 Decadute e F24 Interrotte
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM riam_quater_links rql 
        WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM quinquies_links ql 
        WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      THEN 'PagoPA Interrotte'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
      THEN 'PagoPa'
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
      THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id 
    AND i.canceled_at IS NULL
    AND COALESCE(i.is_paid, FALSE) = FALSE
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(i.amount_cents), 0) > 0;
$$;

-- Aggiorna get_kpi_overdue_by_type per includere F24 Decadute e F24 Interrotte
CREATE OR REPLACE FUNCTION public.get_kpi_overdue_by_type()
RETURNS TABLE(type_label text, amount_cents bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM riam_quater_links rql 
        WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate RQ'
      WHEN NOT r.is_f24 AND EXISTS (
        SELECT 1 FROM quinquies_links ql 
        WHERE ql.pagopa_id = r.id AND ql.unlinked_at IS NULL
      )
      THEN 'PagoPA Migrate R5'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) = 'interrotta'
      THEN 'PagoPA Interrotte'
      WHEN NOT r.is_f24 AND LOWER(COALESCE(r.status, '')) IN ('attiva', 'in_ritardo')
      THEN 'PagoPa'
      WHEN r.is_quater = TRUE
      THEN 'Rottamazione Quater'
      WHEN t.name ILIKE '%riammissione%quater%'
      THEN 'Riammissione Quater'
      WHEN r.is_quinquies = TRUE
      THEN 'Rottamazione Quinquies'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::bigint AS amount_cents
  FROM rateations r
  JOIN rateation_types t ON t.id = r.type_id
  LEFT JOIN installments i ON i.rateation_id = r.id 
    AND i.canceled_at IS NULL
    AND COALESCE(i.is_paid, FALSE) = FALSE
    AND i.due_date < CURRENT_DATE
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(i.amount_cents), 0) > 0;
$$;