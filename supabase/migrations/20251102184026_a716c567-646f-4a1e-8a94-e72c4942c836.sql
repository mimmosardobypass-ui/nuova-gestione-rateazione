-- Correggi le viste KPI per separare Riam.Quater da Rottamazione Quater
-- Problema: tutte le rateazioni con is_quater=TRUE venivano classificate come "Rottamazione Quater"
-- Soluzione: controllare il type_id per distinguere Riam.Quater (id=14) da Rottamazione Quater (id=8)

-- 1. v_kpi_due_by_type
DROP VIEW IF EXISTS v_kpi_due_by_type CASCADE;
CREATE VIEW v_kpi_due_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- PagoPa interrotte migrate a RQ
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    
    -- Riam.Quater (type_id = 14)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Riam.Quater'
      ) THEN 'Riam. Quater'
    
    -- Rottamazione Quater (type_id = 8)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Rottamazione Quater'
      ) THEN 'Rottamazione Quater'
    
    -- Fallback generico per altri is_quater (sicurezza)
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    
    -- PagoPa
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(i.amount_cents), 0) AS amount_cents
FROM rateations r
LEFT JOIN installments i ON i.rateation_id = r.id
WHERE r.owner_uid = auth.uid()
  AND r.status NOT IN ('decaduta', 'estinta')
  AND r.is_deleted = FALSE
GROUP BY type_label;

-- 2. v_kpi_paid_by_type
DROP VIEW IF EXISTS v_kpi_paid_by_type CASCADE;
CREATE VIEW v_kpi_paid_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- PagoPa interrotte migrate a RQ
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    
    -- Riam.Quater (type_id = 14)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Riam.Quater'
      ) THEN 'Riam. Quater'
    
    -- Rottamazione Quater (type_id = 8)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Rottamazione Quater'
      ) THEN 'Rottamazione Quater'
    
    -- Fallback generico per altri is_quater (sicurezza)
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    
    -- PagoPa
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(r.paid_amount_cents), 0) AS amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid()
  AND r.status NOT IN ('decaduta', 'estinta')
  AND r.is_deleted = FALSE
GROUP BY type_label;

-- 3. v_kpi_residual_by_type
DROP VIEW IF EXISTS v_kpi_residual_by_type CASCADE;
CREATE VIEW v_kpi_residual_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- PagoPa interrotte migrate a RQ
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    
    -- Riam.Quater (type_id = 14)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Riam.Quater'
      ) THEN 'Riam. Quater'
    
    -- Rottamazione Quater (type_id = 8)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Rottamazione Quater'
      ) THEN 'Rottamazione Quater'
    
    -- Fallback generico per altri is_quater (sicurezza)
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    
    -- PagoPa
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(r.residual_amount_cents), 0) AS amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid()
  AND r.status = 'attiva'
  AND r.is_deleted = FALSE
GROUP BY type_label;

-- 4. v_kpi_overdue_by_type
DROP VIEW IF EXISTS v_kpi_overdue_by_type CASCADE;
CREATE VIEW v_kpi_overdue_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    
    -- PagoPa interrotte migrate a RQ
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    
    -- Riam.Quater (type_id = 14)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Riam.Quater'
      ) THEN 'Riam. Quater'
    
    -- Rottamazione Quater (type_id = 8)
    WHEN r.is_quater = TRUE 
      AND EXISTS (
        SELECT 1 FROM rateation_types rt
        WHERE rt.id = r.type_id
        AND rt.name = 'Rottamazione Quater'
      ) THEN 'Rottamazione Quater'
    
    -- Fallback generico per altri is_quater (sicurezza)
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    
    -- PagoPa
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(r.overdue_amount_cents), 0) AS amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid()
  AND r.status = 'attiva'
  AND r.is_deleted = FALSE
GROUP BY type_label;