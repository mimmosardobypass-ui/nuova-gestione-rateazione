-- =====================================================
-- SPRINT 1: Database Foundation - SQL Migration (FIXED)
-- =====================================================
-- Fix: is_pagopa non è una colonna di rateations, va derivato da rateation_types
-- =====================================================

-- =====================================================
-- 1. Vista v_rateation_type_label
-- =====================================================
CREATE OR REPLACE VIEW v_rateation_type_label AS
SELECT 
  r.id,
  r.owner_uid,
  r.type_id,
  rt.name as tipo,
  -- Deriva is_pagopa dal nome del tipo
  EXISTS (
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id 
    AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) as is_pagopa,
  CASE
    WHEN r.is_f24 = true THEN 'F24'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt2 
      WHERE rt2.id = r.type_id 
      AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPA'
    WHEN r.is_quater = true AND COALESCE(rt.name, '') ILIKE '%riam%' THEN 'Riam. Quater'
    WHEN r.is_quater = true THEN 'Rottamazione Quater'
    ELSE COALESCE(NULLIF(rt.name, ''), 'Altro')
  END as type_label
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid();

-- =====================================================
-- 2. Vista v_rateations_list_ui (estesa con type_label)
-- =====================================================
DROP VIEW IF EXISTS v_rateations_list_ui;

CREATE VIEW v_rateations_list_ui AS
SELECT 
  r.id,
  r.owner_uid,
  r.number,
  rt.name as tipo,
  r.taxpayer_name,
  r.status,
  -- Deriva is_pagopa dal tipo
  EXISTS (
    SELECT 1 FROM rateation_types rt2 
    WHERE rt2.id = r.type_id 
    AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
  ) as is_pagopa,
  r.is_f24,
  r.is_quater,
  r.type_id,
  r.created_at,
  r.updated_at,
  
  -- Type label standardizzato
  CASE
    WHEN r.is_f24 = true THEN 'F24'
    WHEN EXISTS (
      SELECT 1 FROM rateation_types rt2 
      WHERE rt2.id = r.type_id 
      AND UPPER(COALESCE(rt2.name, '')) LIKE '%PAGOPA%'
    ) THEN 'PagoPA'
    WHEN r.is_quater = true AND COALESCE(rt.name, '') ILIKE '%riam%' THEN 'Riam. Quater'
    WHEN r.is_quater = true THEN 'Rottamazione Quater'
    ELSE COALESCE(NULLIF(rt.name, ''), 'Altro')
  END as type_label,
  
  -- Monetary fields (canonical in cents)
  COALESCE((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id), 0)::bigint as total_amount_cents,
  r.paid_amount_cents,
  r.residual_amount_cents as residual_effective_cents,
  r.overdue_amount_cents as overdue_effective_cents,
  
  -- Installment counters
  COALESCE((SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id), 0)::bigint as installments_total,
  COALESCE((SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = true), 0)::bigint as installments_paid,
  COALESCE((SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = false AND i.due_date < CURRENT_DATE), 0)::bigint as installments_overdue_today,
  
  -- Quater fields (in cents)
  r.original_total_due_cents,
  r.quater_total_due_cents,
  
  -- RQ allocation fields (usando DISTINCT per evitare duplicati)
  COALESCE((
    SELECT SUM(DISTINCT rql.allocated_residual_cents)
    FROM riam_quater_links rql
    WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
  ), 0)::bigint as allocated_residual_cents,
  
  COALESCE((
    SELECT rql.rq_total_at_link_cents
    FROM riam_quater_links rql
    WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
    ORDER BY rql.created_at DESC
    LIMIT 1
  ), NULL) as rq_total_at_link_cents,
  
  -- RQ link fields for PagoPA interruption display (con DISTINCT)
  COALESCE((
    SELECT COUNT(DISTINCT rql.riam_quater_id)
    FROM riam_quater_links rql
    WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
  ), 0)::bigint as linked_rq_count,
  
  (
    SELECT rq.number
    FROM riam_quater_links rql
    JOIN rateations rq ON rq.id = rql.riam_quater_id
    WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
    ORDER BY rql.created_at DESC
    LIMIT 1
  ) as latest_linked_rq_number,
  
  (
    SELECT rql.riam_quater_id
    FROM riam_quater_links rql
    WHERE rql.pagopa_id = r.id AND rql.unlinked_at IS NULL
    ORDER BY rql.created_at DESC
    LIMIT 1
  ) as latest_rq_id

FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.owner_uid = auth.uid();

-- =====================================================
-- 3. Vista v_stats_by_type
-- =====================================================
CREATE OR REPLACE VIEW v_stats_by_type AS
SELECT 
  vtl.type_label,
  COUNT(DISTINCT r.id) as count,
  COALESCE(SUM((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id)), 0)::bigint as total_amount_cents,
  COALESCE(SUM(r.paid_amount_cents), 0)::bigint as paid_amount_cents,
  COALESCE(SUM(CASE WHEN r.status != 'INTERROTTA' THEN r.residual_amount_cents ELSE 0 END), 0)::bigint as residual_amount_cents,
  COALESCE(SUM(CASE WHEN r.status != 'INTERROTTA' THEN r.overdue_amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
FROM v_rateation_type_label vtl
JOIN rateations r ON r.id = vtl.id
WHERE r.owner_uid = auth.uid()
GROUP BY vtl.type_label
ORDER BY vtl.type_label;

-- =====================================================
-- 4. Vista v_stats_by_status
-- =====================================================
CREATE OR REPLACE VIEW v_stats_by_status AS
SELECT 
  COALESCE(r.status, 'unknown') as status,
  COUNT(DISTINCT r.id) as count,
  COALESCE(SUM((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id)), 0)::bigint as total_amount_cents,
  COALESCE(SUM(r.paid_amount_cents), 0)::bigint as paid_amount_cents,
  COALESCE(SUM(r.residual_amount_cents), 0)::bigint as residual_amount_cents,
  COALESCE(SUM(r.overdue_amount_cents), 0)::bigint as overdue_amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid()
GROUP BY r.status
ORDER BY r.status;

-- =====================================================
-- 5. Vista v_stats_by_taxpayer
-- =====================================================
CREATE OR REPLACE VIEW v_stats_by_taxpayer AS
SELECT 
  COALESCE(NULLIF(r.taxpayer_name, ''), 'Sconosciuto') as taxpayer_name,
  COUNT(DISTINCT r.id) as count,
  COALESCE(SUM((SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id)), 0)::bigint as total_amount_cents,
  COALESCE(SUM(r.paid_amount_cents), 0)::bigint as paid_amount_cents,
  COALESCE(SUM(CASE WHEN r.status != 'INTERROTTA' THEN r.residual_amount_cents ELSE 0 END), 0)::bigint as residual_amount_cents,
  COALESCE(SUM(CASE WHEN r.status != 'INTERROTTA' THEN r.overdue_amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid()
GROUP BY COALESCE(NULLIF(r.taxpayer_name, ''), 'Sconosciuto')
ORDER BY residual_amount_cents DESC
LIMIT 50;

-- =====================================================
-- 6. Vista v_stats_cashflow_monthly
-- =====================================================
CREATE OR REPLACE VIEW v_stats_cashflow_monthly AS
SELECT 
  DATE_TRUNC('month', i.due_date)::date as month,
  COUNT(DISTINCT i.id) as installments_count,
  COALESCE(SUM(i.amount_cents), 0)::bigint as due_amount_cents,
  COALESCE(SUM(CASE WHEN i.is_paid = true THEN i.amount_cents ELSE 0 END), 0)::bigint as paid_amount_cents,
  COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount_cents ELSE 0 END), 0)::bigint as unpaid_amount_cents,
  COALESCE(SUM(CASE WHEN i.is_paid = false AND i.due_date < CURRENT_DATE THEN i.amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
FROM installments i
JOIN rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND i.due_date IS NOT NULL
GROUP BY DATE_TRUNC('month', i.due_date)
ORDER BY month ASC;

-- =====================================================
-- 7. RPC get_filtered_stats()
-- =====================================================
CREATE OR REPLACE FUNCTION get_filtered_stats(
  p_start_date date DEFAULT DATE_TRUNC('year', CURRENT_DATE)::date,
  p_end_date date DEFAULT (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::date,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH filtered_rateations AS (
    SELECT 
      r.id,
      r.owner_uid,
      r.status,
      r.taxpayer_name,
      r.paid_amount_cents,
      r.residual_amount_cents,
      r.overdue_amount_cents,
      r.created_at,
      vtl.type_label,
      (SELECT SUM(i.amount_cents) FROM installments i WHERE i.rateation_id = r.id) as total_amount_cents
    FROM rateations r
    LEFT JOIN v_rateation_type_label vtl ON vtl.id = r.id
    WHERE 
      (NOT p_owner_only OR r.owner_uid = auth.uid())
      AND r.created_at::date BETWEEN p_start_date AND p_end_date
      AND (p_type_labels IS NULL OR vtl.type_label = ANY(p_type_labels))
      AND (p_statuses IS NULL OR r.status = ANY(p_statuses))
      AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  ),
  
  agg_by_type AS (
    SELECT 
      type_label,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN status != 'INTERROTTA' THEN residual_amount_cents ELSE 0 END), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(CASE WHEN status != 'INTERROTTA' THEN overdue_amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
    FROM filtered_rateations
    GROUP BY type_label
  ),
  
  agg_by_status AS (
    SELECT 
      COALESCE(status, 'unknown') as status,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(residual_amount_cents), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(overdue_amount_cents), 0)::bigint as overdue_amount_cents
    FROM filtered_rateations
    GROUP BY status
  ),
  
  agg_by_taxpayer AS (
    SELECT 
      COALESCE(NULLIF(taxpayer_name, ''), 'Sconosciuto') as taxpayer_name,
      COUNT(DISTINCT id)::bigint as count,
      COALESCE(SUM(total_amount_cents), 0)::bigint as total_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN status != 'INTERROTTA' THEN residual_amount_cents ELSE 0 END), 0)::bigint as residual_amount_cents,
      COALESCE(SUM(CASE WHEN status != 'INTERROTTA' THEN overdue_amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
    FROM filtered_rateations
    GROUP BY taxpayer_name
    ORDER BY residual_amount_cents DESC
    LIMIT 50
  ),
  
  agg_cashflow AS (
    SELECT 
      DATE_TRUNC('month', i.due_date)::date as month,
      COUNT(DISTINCT i.id)::bigint as installments_count,
      COALESCE(SUM(i.amount_cents), 0)::bigint as due_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid = true THEN i.amount_cents ELSE 0 END), 0)::bigint as paid_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount_cents ELSE 0 END), 0)::bigint as unpaid_amount_cents,
      COALESCE(SUM(CASE WHEN i.is_paid = false AND i.due_date < CURRENT_DATE THEN i.amount_cents ELSE 0 END), 0)::bigint as overdue_amount_cents
    FROM installments i
    WHERE i.rateation_id IN (SELECT id FROM filtered_rateations)
      AND i.due_date IS NOT NULL
      AND i.due_date::date BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('month', i.due_date)
    ORDER BY month ASC
  )
  
  SELECT jsonb_build_object(
    'by_type', COALESCE((SELECT jsonb_agg(row_to_json(agg_by_type)) FROM agg_by_type), '[]'::jsonb),
    'by_status', COALESCE((SELECT jsonb_agg(row_to_json(agg_by_status)) FROM agg_by_status), '[]'::jsonb),
    'by_taxpayer', COALESCE((SELECT jsonb_agg(row_to_json(agg_by_taxpayer)) FROM agg_by_taxpayer), '[]'::jsonb),
    'cashflow', COALESCE((SELECT jsonb_agg(row_to_json(agg_cashflow)) FROM agg_cashflow), '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_filtered_stats TO authenticated;