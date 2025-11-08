-- Fix stats_v3 to support p_group_by='paid' mode
-- This allows filtering and aggregating by actual payment dates instead of due dates

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
  
  -- Build result based on group_by mode
  IF p_group_by = 'paid' THEN
    -- PAID MODE: aggregate installments paid in the period
    WITH paid_installments AS (
      SELECT 
        i.rateation_id,
        i.amount_cents,
        COALESCE(i.paid_date, i.paid_at) AS payment_date
      FROM installments i
      INNER JOIN rateations r ON r.id = i.rateation_id
      WHERE i.is_paid = true
        AND COALESCE(i.paid_date, i.paid_at) IS NOT NULL
        AND (p_date_from IS NULL OR COALESCE(i.paid_date, i.paid_at) >= p_date_from)
        AND (p_date_to IS NULL OR COALESCE(i.paid_date, i.paid_at) <= p_date_to)
        AND (p_owner IS NULL OR r.owner_uid = COALESCE(p_owner, auth.uid()))
        AND r.is_deleted = false
        AND (p_include_interrupted OR r.status <> 'INTERROTTA')
        AND (p_include_decayed OR r.status <> 'decaduta')
    ),
    filtered AS (
      SELECT DISTINCT ON (v.id)
        v.*,
        pi.payment_date
      FROM v_rateations_stats_v3 v
      INNER JOIN paid_installments pi ON pi.rateation_id = v.id
      WHERE (p_owner IS NULL OR v.owner_uid = COALESCE(p_owner, auth.uid()))
        AND (p_types IS NULL OR v.type = ANY(p_types))
        AND (
          (p_statuses IS NULL AND
            (p_include_interrupted OR v.status <> 'INTERROTTA') AND
            (p_include_decayed OR v.status <> 'decaduta')
          )
          OR (p_statuses IS NOT NULL AND v.status = ANY(p_statuses))
        )
    ),
    paid_amounts AS (
      SELECT 
        pi.rateation_id,
        SUM(pi.amount_cents) AS paid_in_period_cents,
        MIN(pi.payment_date) AS first_payment_date
      FROM paid_installments pi
      GROUP BY pi.rateation_id
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
          'group_by', 'paid'
        )
      ),
      'kpis', jsonb_build_object(
        'total_due_cents', COALESCE((SELECT SUM(paid_in_period_cents) FROM paid_amounts), 0),
        'total_paid_cents', COALESCE((SELECT SUM(paid_in_period_cents) FROM paid_amounts), 0),
        'total_residual_cents', 0,
        'total_overdue_cents', 0,
        'total_decayed_cents', 0,
        'rq_saving_cents', v_rq_saving_cents,
        'completion_percent', 100
      ),
      'by_type', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'type', type,
          'count', count,
          'total_cents', total_cents,
          'paid_cents', paid_cents,
          'residual_cents', 0,
          'overdue_cents', 0,
          'avg_completion_percent', 100
        )), '[]'::jsonb)
        FROM (
          SELECT 
            f.type,
            COUNT(DISTINCT f.id)::bigint AS count,
            SUM(pa.paid_in_period_cents)::bigint AS total_cents,
            SUM(pa.paid_in_period_cents)::bigint AS paid_cents
          FROM filtered f
          INNER JOIN paid_amounts pa ON pa.rateation_id = f.id
          GROUP BY f.type
          ORDER BY f.type
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
            f.status,
            COUNT(DISTINCT f.id)::bigint AS count,
            SUM(pa.paid_in_period_cents)::bigint AS total_cents
          FROM filtered f
          INNER JOIN paid_amounts pa ON pa.rateation_id = f.id
          GROUP BY f.status
          ORDER BY f.status
        ) s
      ),
      'series', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'month', month,
          'total_cents', total_cents,
          'paid_cents', paid_cents,
          'residual_cents', 0
        ) ORDER BY month), '[]'::jsonb)
        FROM (
          SELECT 
            DATE_TRUNC('month', pi.payment_date)::date AS month,
            SUM(pi.amount_cents)::bigint AS total_cents,
            SUM(pi.amount_cents)::bigint AS paid_cents
          FROM paid_installments pi
          GROUP BY DATE_TRUNC('month', pi.payment_date)
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
          'total_cents', paid_in_period_cents,
          'paid_cents', paid_in_period_cents,
          'residual_cents', 0,
          'overdue_cents', 0,
          'installments_total', installments_total,
          'installments_paid', installments_paid,
          'completion_percent', completion_percent,
          'created_at', created_at
        ) ORDER BY first_payment_date DESC), '[]'::jsonb)
        FROM (
          SELECT 
            f.id,
            f.number,
            f.type,
            f.status,
            f.taxpayer_name,
            pa.paid_in_period_cents,
            f.installments_total,
            f.installments_paid,
            f.completion_percent,
            f.created_at,
            pa.first_payment_date
          FROM filtered f
          INNER JOIN paid_amounts pa ON pa.rateation_id = f.id
          ORDER BY pa.first_payment_date DESC
          LIMIT 1000
        ) d
      )
    ) INTO v_result FROM (SELECT 1) t;
    
  ELSE
    -- ORIGINAL MODE: filter by created_at or first_due_date
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
          'statuses', p_statuses,
          'group_by', p_group_by
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
          ORDER BY created_at DESC
          LIMIT 1000
        ) d
      )
    ) INTO v_result FROM filtered;
  END IF;
  
  RETURN v_result;
END;
$$;