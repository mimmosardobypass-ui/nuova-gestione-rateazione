-- Fix F24 Migrate categorization: base on link presence, not status
-- This ensures F24 N.3, N.22, N.24 (status INTERROTTA but linked) appear in "F24 Migrate"

-- 1. Update get_kpi_due_by_type
CREATE OR REPLACE FUNCTION get_kpi_due_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- F24 MIGRATE: first check if has link (regardless of status)
      WHEN r.is_f24 = TRUE 
           AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      
      -- F24 IN ATTESA: decadute without link
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      
      -- F24 ATTIVE: only status = attiva
      WHEN r.is_f24 = TRUE 
           AND LOWER(COALESCE(r.status, '')) = 'attiva'
      THEN 'F24'
      
      -- PagoPA active (exclude interrupted ones linked to RQ)
      WHEN rt.name ILIKE '%pagopa%' 
           AND LOWER(COALESCE(r.status, '')) NOT IN ('interrotta', 'decaduta')
      THEN 'PagoPa'
      
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(
      CASE 
        WHEN r.total_amount IS NOT NULL THEN (r.total_amount * 100)::BIGINT
        ELSE 0
      END
    ), 0) AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON r.type_id = rt.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(
    CASE 
      WHEN r.total_amount IS NOT NULL THEN (r.total_amount * 100)::BIGINT
      ELSE 0
    END
  ), 0) > 0
  ORDER BY amount_cents DESC;
$$;

-- 2. Update get_kpi_paid_by_type
CREATE OR REPLACE FUNCTION get_kpi_paid_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- F24 MIGRATE: first check if has link (regardless of status)
      WHEN r.is_f24 = TRUE 
           AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      
      -- F24 IN ATTESA: decadute without link
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      
      -- F24 ATTIVE: only status = attiva
      WHEN r.is_f24 = TRUE 
           AND LOWER(COALESCE(r.status, '')) = 'attiva'
      THEN 'F24'
      
      -- PagoPA active (exclude interrupted ones linked to RQ)
      WHEN rt.name ILIKE '%pagopa%' 
           AND LOWER(COALESCE(r.status, '')) NOT IN ('interrotta', 'decaduta')
      THEN 'PagoPa'
      
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(COALESCE(r.paid_amount_cents, 0)), 0) AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON r.type_id = rt.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(COALESCE(r.paid_amount_cents, 0)), 0) > 0
  ORDER BY amount_cents DESC;
$$;

-- 3. Update get_kpi_residual_by_type
CREATE OR REPLACE FUNCTION get_kpi_residual_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- F24 MIGRATE: first check if has link (regardless of status)
      WHEN r.is_f24 = TRUE 
           AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      
      -- F24 IN ATTESA: decadute without link
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      
      -- F24 ATTIVE: only status = attiva
      WHEN r.is_f24 = TRUE 
           AND LOWER(COALESCE(r.status, '')) = 'attiva'
      THEN 'F24'
      
      -- PagoPA active (exclude interrupted ones linked to RQ)
      WHEN rt.name ILIKE '%pagopa%' 
           AND LOWER(COALESCE(r.status, '')) NOT IN ('interrotta', 'decaduta')
      THEN 'PagoPa'
      
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(COALESCE(r.residual_amount_cents, 0)), 0) AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON r.type_id = rt.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(COALESCE(r.residual_amount_cents, 0)), 0) > 0
  ORDER BY amount_cents DESC;
$$;

-- 4. Update get_kpi_overdue_by_type
CREATE OR REPLACE FUNCTION get_kpi_overdue_by_type()
RETURNS TABLE(type_label TEXT, amount_cents BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- F24 MIGRATE: first check if has link (regardless of status)
      WHEN r.is_f24 = TRUE 
           AND EXISTS (SELECT 1 FROM f24_pagopa_links l WHERE l.f24_id = r.id)
      THEN 'F24 Migrate'
      
      -- F24 IN ATTESA: decadute without link
      WHEN r.is_f24 = TRUE 
           AND UPPER(COALESCE(r.status, '')) = 'DECADUTA'
      THEN 'F24 In Attesa'
      
      -- F24 ATTIVE: only status = attiva
      WHEN r.is_f24 = TRUE 
           AND LOWER(COALESCE(r.status, '')) = 'attiva'
      THEN 'F24'
      
      -- PagoPA active (exclude interrupted ones linked to RQ)
      WHEN rt.name ILIKE '%pagopa%' 
           AND LOWER(COALESCE(r.status, '')) NOT IN ('interrotta', 'decaduta')
      THEN 'PagoPa'
      
      -- Rottamazione Quater
      WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
      
      -- Rottamazione Quinquies
      WHEN r.is_quinquies = TRUE THEN 'Rottamazione Quinquies'
      
      -- Riammissione Quater
      WHEN rt.name ILIKE '%riam%quater%' THEN 'Riam. Quater'
      
      ELSE 'Altro'
    END AS type_label,
    COALESCE(SUM(COALESCE(r.overdue_amount_cents, 0)), 0) AS amount_cents
  FROM rateations r
  JOIN rateation_types rt ON r.type_id = rt.id
  WHERE r.owner_uid = auth.uid()
    AND r.is_deleted = FALSE
  GROUP BY 1
  HAVING COALESCE(SUM(COALESCE(r.overdue_amount_cents, 0)), 0) > 0
  ORDER BY amount_cents DESC;
$$;