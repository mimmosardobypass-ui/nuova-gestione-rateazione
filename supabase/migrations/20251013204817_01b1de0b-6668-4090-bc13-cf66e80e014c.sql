-- ========================================
-- STATISTICHE AVANZATE V3 - Database Layer
-- ========================================

-- 1. View estesa con calcolo completamento e dati decadenza
CREATE OR REPLACE VIEW v_rateations_stats_v3 AS
SELECT 
  r.id,
  r.owner_uid,
  r.number,
  r.taxpayer_name,
  r.created_at,
  LOWER(COALESCE(r.status, 'attiva')) AS status,
  UPPER(COALESCE(rt.name, 'ALTRO')) AS type,
  COALESCE((r.total_amount * 100)::bigint, 0) AS total_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_cents,
  COALESCE(r.overdue_amount_cents, 0) AS overdue_cents,
  COALESCE(r.residual_at_decadence_cents, 0) AS decayed_cents,
  (SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id) AS installments_total,
  (SELECT COUNT(*) FROM installments i WHERE i.rateation_id = r.id AND i.is_paid = true) AS installments_paid,
  CASE 
    WHEN COALESCE((r.total_amount * 100)::bigint, 0) > 0 
    THEN ROUND((r.paid_amount_cents::numeric / (r.total_amount * 100)) * 100, 2)
    ELSE 0 
  END AS completion_percent,
  (SELECT MIN(due_date) FROM installments i WHERE i.rateation_id = r.id) AS first_due_date
FROM rateations r
JOIN rateation_types rt ON rt.id = r.type_id
WHERE r.is_deleted = false;

-- 2. RPC stats_v3 con output JSON completo
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT * FROM v_rateations_stats_v3 v
    WHERE (p_owner IS NULL OR v.owner_uid = COALESCE(p_owner, auth.uid()))
      AND (p_types IS NULL OR v.type = ANY(p_types))
      AND (p_statuses IS NULL OR v.status = ANY(p_statuses))
      AND (p_date_from IS NULL OR v.created_at >= p_date_from)
      AND (p_date_to IS NULL OR v.created_at <= p_date_to)
      AND (p_include_interrupted OR v.status != 'interrotta')
      AND (p_include_decayed OR v.status != 'decaduta')
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(total_cents), 0) AS total_due_cents,
      COALESCE(SUM(paid_cents), 0) AS total_paid_cents,
      COALESCE(SUM(residual_cents), 0) AS total_residual_cents,
      COALESCE(SUM(overdue_cents), 0) AS total_overdue_cents,
      COALESCE(SUM(CASE WHEN status = 'decaduta' THEN decayed_cents ELSE 0 END), 0) AS total_decayed_cents,
      CASE 
        WHEN SUM(total_cents) > 0 
        THEN ROUND((SUM(paid_cents)::numeric / SUM(total_cents)) * 100, 2)
        ELSE 0 
      END AS completion_percent
    FROM filtered
  ),
  rq_saving AS (
    SELECT COALESCE(SUM(saving_eur * 100), 0)::bigint AS rq_saving_cents
    FROM v_quater_saving_per_user
    WHERE owner_uid = COALESCE(p_owner, auth.uid())
  )
  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'version', '3.0',
      'generated_at', now(),
      'filters_applied', jsonb_build_object(
        'date_from', p_date_from,
        'date_to', p_date_to,
        'types', p_types,
        'statuses', p_statuses,
        'include_interrupted', p_include_interrupted,
        'include_decayed', p_include_decayed,
        'group_by', p_group_by
      )
    ),
    'kpis', (
      SELECT jsonb_build_object(
        'total_due_cents', k.total_due_cents,
        'total_paid_cents', k.total_paid_cents,
        'total_residual_cents', k.total_residual_cents,
        'total_overdue_cents', k.total_overdue_cents,
        'total_decayed_cents', k.total_decayed_cents,
        'rq_saving_cents', (SELECT rq_saving_cents FROM rq_saving),
        'completion_percent', k.completion_percent
      )
      FROM kpis k
    ),
    'by_type', (
      SELECT COALESCE(jsonb_agg(row_to_json(t.*) ORDER BY t.type), '[]'::jsonb)
      FROM (
        SELECT 
          type,
          COUNT(*)::bigint AS count,
          SUM(total_cents) AS total_cents,
          SUM(paid_cents) AS paid_cents,
          SUM(residual_cents) AS residual_cents,
          SUM(overdue_cents) AS overdue_cents,
          ROUND(AVG(completion_percent), 2) AS avg_completion_percent
        FROM filtered
        GROUP BY type
      ) t
    ),
    'by_status', (
      SELECT COALESCE(jsonb_agg(row_to_json(s.*) ORDER BY s.status), '[]'::jsonb)
      FROM (
        SELECT 
          status,
          COUNT(*)::bigint AS count,
          SUM(total_cents) AS total_cents
        FROM filtered
        GROUP BY status
      ) s
    ),
    'series', (
      SELECT COALESCE(jsonb_agg(row_to_json(m.*) ORDER BY m.month), '[]'::jsonb)
      FROM (
        SELECT 
          DATE_TRUNC('month', created_at)::date AS month,
          SUM(total_cents) AS total_cents,
          SUM(paid_cents) AS paid_cents,
          SUM(residual_cents) AS residual_cents
        FROM filtered
        GROUP BY DATE_TRUNC('month', created_at)
      ) m
    ),
    'details', (
      SELECT COALESCE(jsonb_agg(row_to_json(d.*) ORDER BY d.created_at DESC), '[]'::jsonb)
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
  );
$$;

-- 3. Permessi
GRANT EXECUTE ON FUNCTION public.stats_v3(date, date, text[], text[], boolean, boolean, text, uuid) TO authenticated, service_role, anon, supabase_read_only_user, postgres;

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';