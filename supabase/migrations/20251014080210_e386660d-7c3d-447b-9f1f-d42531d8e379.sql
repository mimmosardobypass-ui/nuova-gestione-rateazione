-- ============================================================
-- STATS V3 - View + RPC con filtri normalizzati (FIX v3)
-- ============================================================

-- 1. DROP view esistente con CASCADE
DROP VIEW IF EXISTS v_rateations_stats_v3 CASCADE;

-- 2. CREATE view v_rateations_stats_v3 (nuova struttura)
CREATE VIEW v_rateations_stats_v3 AS
SELECT 
  r.id,
  r.owner_uid,
  r.number,
  r.taxpayer_name,
  r.created_at,
  r.status,
  CASE
    WHEN UPPER(rt.name) LIKE 'F24%' THEN 'F24'
    WHEN UPPER(rt.name) LIKE 'PAGOPA%' THEN 'PAGOPA'
    WHEN UPPER(rt.name) LIKE '%ROTTAMAZIONE%QUATER%' THEN 'ROTTAMAZIONE_QUATER'
    WHEN UPPER(rt.name) LIKE '%RIAMMISSIONE%QUATER%' THEN 'RIAMMISSIONE_QUATER'
    ELSE 'ALTRO'
  END AS type,
  COALESCE(r.total_amount * 100, 0)::bigint AS total_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_cents,
  COALESCE(r.overdue_amount_cents, 0) AS overdue_cents,
  COALESCE(r.residual_at_decadence_cents, 0) AS decayed_cents,
  (SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id) AS installments_total,
  (SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid) AS installments_paid,
  (SELECT MIN(due_date) FROM installments i WHERE i.rateation_id = r.id) AS first_due_date,
  CASE 
    WHEN r.total_amount > 0 
    THEN ROUND((r.paid_amount_cents::numeric / (r.total_amount * 100)) * 100, 2)
    ELSE 0 
  END AS completion_percent
FROM rateations r
JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.is_deleted = false;

-- 3. CREATE function stats_v3
CREATE OR REPLACE FUNCTION public.stats_v3(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_include_interrupted boolean DEFAULT false,
  p_include_decayed boolean DEFAULT false,
  p_group_by text DEFAULT 'due',
  p_owner uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_kpis jsonb;
  v_rq_saving_cents bigint;
BEGIN
  -- Get RQ saving
  SELECT COALESCE(SUM(saving_eur * 100), 0)::bigint 
  INTO v_rq_saving_cents
  FROM v_quater_saving_per_user
  WHERE owner_uid = COALESCE(p_owner, auth.uid());
  
  -- Build result
  WITH filtered AS (
    SELECT * FROM v_rateations_stats_v3 v
    WHERE (p_owner IS NULL OR v.owner_uid = COALESCE(p_owner, auth.uid()))
      AND (p_types IS NULL OR v.type = ANY(p_types))
      AND (
        (p_statuses IS NULL AND
          (p_include_interrupted OR v.status <> 'INTERROTTA') AND
          (p_include_decayed OR v.status <> 'decaduta')
        )
        OR (p_statuses IS NOT NULL AND v.status = ANY(p_statuses))
      )
      AND (
        (p_group_by = 'created' AND
          (p_date_from IS NULL OR v.created_at >= p_date_from) AND
          (p_date_to IS NULL OR v.created_at < p_date_to + 1)
        )
        OR
        (p_group_by = 'due' AND
          (p_date_from IS NULL OR v.first_due_date >= p_date_from) AND
          (p_date_to IS NULL OR v.first_due_date < p_date_to + 1)
        )
      )
  )
  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'version', '3.0',
      'generated_at', now(),
      'filters_applied', jsonb_build_object(
        'date_from', p_date_from,
        'date_to', p_date_to,
        'types', p_types,
        'statuses', p_statuses
      )
    ),
    'kpis', jsonb_build_object(
      'total_due_cents', COALESCE(SUM(total_cents), 0),
      'total_paid_cents', COALESCE(SUM(paid_cents), 0),
      'total_residual_cents', COALESCE(SUM(residual_cents), 0),
      'total_overdue_cents', COALESCE(SUM(overdue_cents), 0),
      'total_decayed_cents', COALESCE(SUM(decayed_cents), 0),
      'rq_saving_cents', v_rq_saving_cents,
      'completion_percent', CASE 
        WHEN SUM(total_cents) > 0 
        THEN ROUND((SUM(paid_cents)::numeric / SUM(total_cents)) * 100, 2)
        ELSE 0 
      END
    ),
    'by_type', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', type,
        'count', count,
        'total_cents', total_cents,
        'paid_cents', paid_cents,
        'residual_cents', residual_cents,
        'overdue_cents', overdue_cents,
        'avg_completion_percent', avg_completion_percent
      )), '[]'::jsonb)
      FROM (
        SELECT 
          type,
          COUNT(*)::bigint AS count,
          SUM(total_cents)::bigint AS total_cents,
          SUM(paid_cents)::bigint AS paid_cents,
          SUM(residual_cents)::bigint AS residual_cents,
          SUM(overdue_cents)::bigint AS overdue_cents,
          ROUND(AVG(completion_percent), 2) AS avg_completion_percent
        FROM filtered
        GROUP BY type
        ORDER BY type
      ) t
    ),
    'by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'status', status,
        'count', count,
        'total_cents', total_cents
      )), '[]'::jsonb)
      FROM (
        SELECT 
          status,
          COUNT(*)::bigint AS count,
          SUM(total_cents)::bigint AS total_cents
        FROM filtered
        GROUP BY status
        ORDER BY status
      ) s
    ),
    'series', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'month', month,
        'total_cents', total_cents,
        'paid_cents', paid_cents,
        'residual_cents', residual_cents
      ) ORDER BY month), '[]'::jsonb)
      FROM (
        SELECT 
          DATE_TRUNC('month', 
            CASE WHEN p_group_by = 'created' THEN created_at ELSE first_due_date END
          )::date AS month,
          SUM(total_cents)::bigint AS total_cents,
          SUM(paid_cents)::bigint AS paid_cents,
          SUM(residual_cents)::bigint AS residual_cents
        FROM filtered
        GROUP BY DATE_TRUNC('month', CASE WHEN p_group_by = 'created' THEN created_at ELSE first_due_date END)
        ORDER BY month
      ) m
    ),
    'details', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'number', number,
        'type', type,
        'status', status,
        'taxpayer_name', taxpayer_name,
        'total_cents', total_cents,
        'paid_cents', paid_cents,
        'residual_cents', residual_cents,
        'overdue_cents', overdue_cents,
        'installments_total', installments_total,
        'installments_paid', installments_paid,
        'completion_percent', completion_percent,
        'created_at', created_at
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT 
          id,
          number,
          type,
          status,
          taxpayer_name,
          total_cents,
          paid_cents,
          residual_cents,
          overdue_cents,
          installments_total,
          installments_paid,
          completion_percent,
          created_at
        FROM filtered
        LIMIT 1000
      ) d
    )
  ) INTO v_result
  FROM filtered;
  
  RETURN v_result;
END;
$$;

-- 4. Grant permessi
GRANT EXECUTE ON FUNCTION public.stats_v3(date, date, text[], text[], boolean, boolean, text, uuid) TO authenticated, service_role, anon;

-- 5. Reload schema
NOTIFY pgrst, 'reload schema';