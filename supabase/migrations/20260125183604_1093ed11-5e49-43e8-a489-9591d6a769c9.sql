-- Aggiorna get_kpi_due_by_type per separare F24 in 3 categorie
CREATE OR REPLACE FUNCTION public.get_kpi_due_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    CASE
      -- F24 ATTIVE (non decadute)
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) != 'DECADUTA'
      THEN 'F24'
      
      -- F24 DECADUTE GIÀ MIGRATE (con link verso PagoPA)
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
           AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      
      -- F24 DECADUTE IN ATTESA CARTELLA (senza link)
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      
      -- PagoPA
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      -- Riam. Quater (basato su nome tipo)
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND i.canceled_at IS NULL
    -- Esclude PagoPA interrotte (già migrate a RQ)
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND r.interrupted_at IS NOT NULL
    )
  GROUP BY 
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END
  ORDER BY type_label;
$$;

-- Aggiorna get_kpi_paid_by_type per separare F24 in 3 categorie
CREATE OR REPLACE FUNCTION public.get_kpi_paid_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND i.canceled_at IS NULL
    AND i.is_paid = TRUE
    -- Esclude PagoPA interrotte
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND r.interrupted_at IS NOT NULL
    )
  GROUP BY 
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END
  ORDER BY type_label;
$$;

-- Aggiorna get_kpi_residual_by_type per separare F24 in 3 categorie
CREATE OR REPLACE FUNCTION public.get_kpi_residual_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND i.canceled_at IS NULL
    AND i.is_paid = FALSE
    -- Esclude PagoPA interrotte
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND r.interrupted_at IS NOT NULL
    )
  GROUP BY 
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END
  ORDER BY type_label;
$$;

-- Aggiorna get_kpi_overdue_by_type per separare F24 in 3 categorie
CREATE OR REPLACE FUNCTION public.get_kpi_overdue_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(i.amount_cents), 0)::BIGINT AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON rt.id = r.type_id
  JOIN installments i ON i.rateation_id = r.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
    AND i.canceled_at IS NULL
    AND i.is_paid = FALSE
    AND i.due_date < CURRENT_DATE
    AND LOWER(COALESCE(r.status, '')) = 'attiva'
    -- Esclude PagoPA interrotte
    AND NOT (
      rt.name ILIKE '%pagopa%' 
      AND r.interrupted_at IS NOT NULL
    )
  GROUP BY 
    CASE
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) != 'DECADUTA' THEN 'F24'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id) THEN 'F24 Migrate'
      WHEN r.is_f24 = TRUE AND UPPER(COALESCE(r.status, '')) = 'DECADUTA' THEN 'F24 In Attesa'
      WHEN rt.name ILIKE '%pagopa%' THEN 'PagoPa'
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      ELSE 'Altro'
    END
  ORDER BY type_label;
$$;