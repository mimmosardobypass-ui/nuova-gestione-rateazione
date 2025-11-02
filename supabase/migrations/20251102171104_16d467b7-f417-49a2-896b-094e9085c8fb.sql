-- Vista: Breakdown TOTALE DOVUTO per tipo
CREATE OR REPLACE VIEW public.v_kpi_due_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM((r.total_amount * 100)::bigint), 0) AS amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    (r.residual_amount_cents > 0 
     AND r.status NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    (r.is_f24 = TRUE AND r.status = 'DECADUTA' AND r.residual_amount_cents > 0)
  )
GROUP BY type_label;

-- Vista: Breakdown TOTALE PAGATO per tipo
CREATE OR REPLACE VIEW public.v_kpi_paid_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(r.paid_amount_cents), 0) AS amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    (r.residual_amount_cents > 0 
     AND r.status NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    (r.is_f24 = TRUE AND r.status = 'DECADUTA' AND r.residual_amount_cents > 0)
  )
GROUP BY type_label;

-- Vista: Breakdown RESIDUO per tipo
CREATE OR REPLACE VIEW public.v_kpi_residual_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(r.residual_amount_cents), 0) AS amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    (r.residual_amount_cents > 0 
     AND r.status NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    (r.is_f24 = TRUE AND r.status = 'DECADUTA' AND r.residual_amount_cents > 0)
  )
GROUP BY type_label;

-- Vista: Breakdown IN RITARDO per tipo
CREATE OR REPLACE VIEW public.v_kpi_overdue_by_type AS
SELECT
  CASE
    WHEN r.is_f24 = TRUE THEN 'F24'
    WHEN r.interrupted_by_rateation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM rateations rq 
        WHERE rq.id = r.interrupted_by_rateation_id 
        AND rq.is_quater = TRUE
      ) THEN 'Riam. Quater'
    WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt 
      WHERE rt.id = r.type_id 
      AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPa'
    ELSE 'Altro'
  END AS type_label,
  COALESCE(SUM(r.overdue_amount_cents), 0) AS amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    (r.residual_amount_cents > 0 
     AND r.status NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    (r.is_f24 = TRUE AND r.status = 'DECADUTA' AND r.residual_amount_cents > 0)
  )
GROUP BY type_label;