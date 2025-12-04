-- Fix stats_v3 to aggregate at installment level instead of rateation level
-- When groupBy = 'due', KPIs should reflect only installments with due_date in period

CREATE OR REPLACE FUNCTION public.stats_v3(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_include_interrupted boolean DEFAULT true,
  p_include_decayed boolean DEFAULT true,
  p_group_by text DEFAULT 'due',
  p_owner uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_kpis jsonb;
  v_by_type jsonb;
  v_by_status jsonb;
  v_series jsonb;
  v_details jsonb;
  v_norm_types text[];
  v_norm_statuses text[];
  v_owner_uid uuid;
BEGIN
  -- Normalize inputs
  v_norm_types := norm_upper_arr(p_types);
  v_norm_statuses := norm_lower_arr(p_statuses);
  v_owner_uid := COALESCE(p_owner, auth.uid());

  -- ============================================================
  -- KPIs: Calculate based on INSTALLMENTS in the period
  -- ============================================================
  WITH filtered_installments AS (
    SELECT 
      i.id as installment_id,
      i.rateation_id,
      i.amount_cents,
      i.is_paid,
      i.due_date,
      COALESCE(i.paid_date, i.paid_at) as paid_date,
      r.status as rateation_status,
      CASE
        WHEN r.is_f24 = TRUE THEN 'F24'
        WHEN r.is_quater = TRUE AND EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
        ) THEN 'RIAMMISSIONE_QUATER'
        WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
        WHEN EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
        ) THEN 'PAGOPA'
        ELSE 'ALTRO'
      END AS type_label
    FROM installments i
    JOIN rateations r ON r.id = i.rateation_id
    WHERE r.owner_uid = v_owner_uid
      AND COALESCE(r.is_deleted, false) = false
      -- Date filter on installments based on group_by mode
      AND (
        CASE 
          WHEN p_group_by = 'paid' THEN
            COALESCE(i.paid_date, i.paid_at) IS NOT NULL
            AND (p_date_from IS NULL OR COALESCE(i.paid_date, i.paid_at) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.paid_date, i.paid_at) <= p_date_to)
          ELSE -- 'due' mode
            (p_date_from IS NULL OR i.due_date >= p_date_from)
            AND (p_date_to IS NULL OR i.due_date <= p_date_to)
        END
      )
      -- Status filters
      AND (
        v_norm_statuses IS NULL 
        OR LOWER(COALESCE(r.status, 'attiva')) = ANY(v_norm_statuses)
      )
      AND (p_include_interrupted = true OR LOWER(COALESCE(r.status, '')) != 'interrotta')
      AND (p_include_decayed = true OR LOWER(COALESCE(r.status, '')) != 'decaduta')
      -- Type filters
      AND (
        v_norm_types IS NULL 
        OR CASE
          WHEN r.is_f24 = TRUE THEN 'F24'
          WHEN r.is_quater = TRUE AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'RIAMMISSIONE_QUATER'
          WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
          WHEN EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
          ) THEN 'PAGOPA'
          ELSE 'ALTRO'
        END = ANY(v_norm_types)
      )
  ),
  kpi_calc AS (
    SELECT
      COALESCE(SUM(amount_cents), 0) as total_due_cents,
      COALESCE(SUM(CASE WHEN is_paid THEN amount_cents ELSE 0 END), 0) as total_paid_cents,
      COALESCE(SUM(CASE WHEN NOT is_paid THEN amount_cents ELSE 0 END), 0) as total_residual_cents,
      COALESCE(SUM(CASE WHEN NOT is_paid AND due_date < CURRENT_DATE THEN amount_cents ELSE 0 END), 0) as total_overdue_cents
    FROM filtered_installments
  ),
  -- RQ Saving calculation (based on rateations with is_quater=true)
  rq_saving AS (
    SELECT COALESCE(SUM(
      COALESCE(r.original_total_due_cents, 0) - COALESCE(r.quater_total_due_cents, 0)
    ), 0) as rq_saving_cents
    FROM rateations r
    WHERE r.owner_uid = v_owner_uid
      AND r.is_quater = true
      AND COALESCE(r.is_deleted, false) = false
      AND (p_include_decayed = true OR LOWER(COALESCE(r.status, '')) != 'decaduta')
  ),
  -- Decayed amount (snapshot from decaduta rateations)
  decayed_calc AS (
    SELECT COALESCE(SUM(COALESCE(r.residual_at_decadence_cents, 0)), 0) as total_decayed_cents
    FROM rateations r
    WHERE r.owner_uid = v_owner_uid
      AND LOWER(COALESCE(r.status, '')) = 'decaduta'
      AND COALESCE(r.is_deleted, false) = false
      AND (
        v_norm_types IS NULL 
        OR CASE
          WHEN r.is_f24 = TRUE THEN 'F24'
          WHEN r.is_quater = TRUE AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'RIAMMISSIONE_QUATER'
          WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
          WHEN EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
          ) THEN 'PAGOPA'
          ELSE 'ALTRO'
        END = ANY(v_norm_types)
      )
  )
  SELECT jsonb_build_object(
    'total_due_cents', k.total_due_cents,
    'total_paid_cents', k.total_paid_cents,
    'total_residual_cents', k.total_residual_cents,
    'total_overdue_cents', k.total_overdue_cents,
    'total_decayed_cents', d.total_decayed_cents,
    'rq_saving_cents', rq.rq_saving_cents,
    'completion_percent', CASE 
      WHEN k.total_due_cents > 0 THEN ROUND((k.total_paid_cents::numeric / k.total_due_cents::numeric) * 100, 1)
      ELSE 0 
    END
  )
  INTO v_kpis
  FROM kpi_calc k, rq_saving rq, decayed_calc d;

  -- ============================================================
  -- BY TYPE: Aggregate installments by type
  -- ============================================================
  WITH filtered_installments AS (
    SELECT 
      i.amount_cents,
      i.is_paid,
      i.due_date,
      r.id as rateation_id,
      CASE
        WHEN r.is_f24 = TRUE THEN 'F24'
        WHEN r.is_quater = TRUE AND EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
        ) THEN 'Riam. Quater'
        WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
        WHEN EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
        ) THEN 'PagoPa'
        ELSE 'Altro'
      END AS type_label
    FROM installments i
    JOIN rateations r ON r.id = i.rateation_id
    WHERE r.owner_uid = v_owner_uid
      AND COALESCE(r.is_deleted, false) = false
      AND (
        CASE 
          WHEN p_group_by = 'paid' THEN
            COALESCE(i.paid_date, i.paid_at) IS NOT NULL
            AND (p_date_from IS NULL OR COALESCE(i.paid_date, i.paid_at) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.paid_date, i.paid_at) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.due_date >= p_date_from)
            AND (p_date_to IS NULL OR i.due_date <= p_date_to)
        END
      )
      AND (v_norm_statuses IS NULL OR LOWER(COALESCE(r.status, 'attiva')) = ANY(v_norm_statuses))
      AND (p_include_interrupted = true OR LOWER(COALESCE(r.status, '')) != 'interrotta')
      AND (p_include_decayed = true OR LOWER(COALESCE(r.status, '')) != 'decaduta')
      AND (
        v_norm_types IS NULL 
        OR CASE
          WHEN r.is_f24 = TRUE THEN 'F24'
          WHEN r.is_quater = TRUE AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'RIAMMISSIONE_QUATER'
          WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
          WHEN EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
          ) THEN 'PAGOPA'
          ELSE 'ALTRO'
        END = ANY(v_norm_types)
      )
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_by_type
  FROM (
    SELECT 
      type_label as type,
      COUNT(DISTINCT rateation_id) as count,
      SUM(amount_cents)::bigint as total_cents,
      SUM(CASE WHEN is_paid THEN amount_cents ELSE 0 END)::bigint as paid_cents,
      SUM(CASE WHEN NOT is_paid THEN amount_cents ELSE 0 END)::bigint as residual_cents,
      SUM(CASE WHEN NOT is_paid AND due_date < CURRENT_DATE THEN amount_cents ELSE 0 END)::bigint as overdue_cents,
      CASE 
        WHEN SUM(amount_cents) > 0 
        THEN ROUND((SUM(CASE WHEN is_paid THEN amount_cents ELSE 0 END)::numeric / SUM(amount_cents)::numeric) * 100, 1)
        ELSE 0 
      END as avg_completion_percent
    FROM filtered_installments
    GROUP BY type_label
    ORDER BY type_label
  ) t;

  -- ============================================================
  -- BY STATUS: Aggregate installments by rateation status
  -- ============================================================
  WITH filtered_installments AS (
    SELECT 
      i.amount_cents,
      COALESCE(r.status, 'attiva') as status
    FROM installments i
    JOIN rateations r ON r.id = i.rateation_id
    WHERE r.owner_uid = v_owner_uid
      AND COALESCE(r.is_deleted, false) = false
      AND (
        CASE 
          WHEN p_group_by = 'paid' THEN
            COALESCE(i.paid_date, i.paid_at) IS NOT NULL
            AND (p_date_from IS NULL OR COALESCE(i.paid_date, i.paid_at) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.paid_date, i.paid_at) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.due_date >= p_date_from)
            AND (p_date_to IS NULL OR i.due_date <= p_date_to)
        END
      )
      AND (v_norm_statuses IS NULL OR LOWER(COALESCE(r.status, 'attiva')) = ANY(v_norm_statuses))
      AND (p_include_interrupted = true OR LOWER(COALESCE(r.status, '')) != 'interrotta')
      AND (p_include_decayed = true OR LOWER(COALESCE(r.status, '')) != 'decaduta')
      AND (
        v_norm_types IS NULL 
        OR CASE
          WHEN r.is_f24 = TRUE THEN 'F24'
          WHEN r.is_quater = TRUE AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'RIAMMISSIONE_QUATER'
          WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
          WHEN EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
          ) THEN 'PAGOPA'
          ELSE 'ALTRO'
        END = ANY(v_norm_types)
      )
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_by_status
  FROM (
    SELECT 
      status,
      COUNT(*) as count,
      SUM(amount_cents)::bigint as total_cents
    FROM filtered_installments
    GROUP BY status
    ORDER BY status
  ) t;

  -- ============================================================
  -- SERIES: Monthly aggregation of installments
  -- ============================================================
  WITH filtered_installments AS (
    SELECT 
      i.amount_cents,
      i.is_paid,
      i.due_date,
      COALESCE(i.paid_date, i.paid_at) as paid_date
    FROM installments i
    JOIN rateations r ON r.id = i.rateation_id
    WHERE r.owner_uid = v_owner_uid
      AND COALESCE(r.is_deleted, false) = false
      AND (
        CASE 
          WHEN p_group_by = 'paid' THEN
            COALESCE(i.paid_date, i.paid_at) IS NOT NULL
            AND (p_date_from IS NULL OR COALESCE(i.paid_date, i.paid_at) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.paid_date, i.paid_at) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.due_date >= p_date_from)
            AND (p_date_to IS NULL OR i.due_date <= p_date_to)
        END
      )
      AND (v_norm_statuses IS NULL OR LOWER(COALESCE(r.status, 'attiva')) = ANY(v_norm_statuses))
      AND (p_include_interrupted = true OR LOWER(COALESCE(r.status, '')) != 'interrotta')
      AND (p_include_decayed = true OR LOWER(COALESCE(r.status, '')) != 'decaduta')
      AND (
        v_norm_types IS NULL 
        OR CASE
          WHEN r.is_f24 = TRUE THEN 'F24'
          WHEN r.is_quater = TRUE AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'RIAMMISSIONE_QUATER'
          WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
          WHEN EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
          ) THEN 'PAGOPA'
          ELSE 'ALTRO'
        END = ANY(v_norm_types)
      )
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.month), '[]'::jsonb)
  INTO v_series
  FROM (
    SELECT 
      TO_CHAR(
        CASE WHEN p_group_by = 'paid' THEN paid_date ELSE due_date END,
        'YYYY-MM'
      ) as month,
      SUM(amount_cents)::bigint as total_cents,
      SUM(CASE WHEN is_paid THEN amount_cents ELSE 0 END)::bigint as paid_cents,
      SUM(CASE WHEN NOT is_paid THEN amount_cents ELSE 0 END)::bigint as residual_cents
    FROM filtered_installments
    WHERE CASE WHEN p_group_by = 'paid' THEN paid_date ELSE due_date END IS NOT NULL
    GROUP BY TO_CHAR(
      CASE WHEN p_group_by = 'paid' THEN paid_date ELSE due_date END,
      'YYYY-MM'
    )
  ) t;

  -- ============================================================
  -- DETAILS: List of rateations with installments in period
  -- ============================================================
  WITH rateation_installments AS (
    SELECT 
      r.id,
      r.number,
      r.taxpayer_name,
      r.status,
      r.created_at,
      CASE
        WHEN r.is_f24 = TRUE THEN 'F24'
        WHEN r.is_quater = TRUE AND EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
        ) THEN 'Riam. Quater'
        WHEN r.is_quater = TRUE THEN 'Rottamazione Quater'
        WHEN EXISTS (
          SELECT 1 FROM rateation_types rt 
          WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
        ) THEN 'PagoPa'
        ELSE 'Altro'
      END AS type,
      -- Totals from installments in period only
      SUM(i.amount_cents) as total_cents,
      SUM(CASE WHEN i.is_paid THEN i.amount_cents ELSE 0 END) as paid_cents,
      SUM(CASE WHEN NOT i.is_paid THEN i.amount_cents ELSE 0 END) as residual_cents,
      SUM(CASE WHEN NOT i.is_paid AND i.due_date < CURRENT_DATE THEN i.amount_cents ELSE 0 END) as overdue_cents,
      COUNT(*) as installments_total,
      COUNT(*) FILTER (WHERE i.is_paid) as installments_paid
    FROM rateations r
    JOIN installments i ON i.rateation_id = r.id
    WHERE r.owner_uid = v_owner_uid
      AND COALESCE(r.is_deleted, false) = false
      AND (
        CASE 
          WHEN p_group_by = 'paid' THEN
            COALESCE(i.paid_date, i.paid_at) IS NOT NULL
            AND (p_date_from IS NULL OR COALESCE(i.paid_date, i.paid_at) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.paid_date, i.paid_at) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.due_date >= p_date_from)
            AND (p_date_to IS NULL OR i.due_date <= p_date_to)
        END
      )
      AND (v_norm_statuses IS NULL OR LOWER(COALESCE(r.status, 'attiva')) = ANY(v_norm_statuses))
      AND (p_include_interrupted = true OR LOWER(COALESCE(r.status, '')) != 'interrotta')
      AND (p_include_decayed = true OR LOWER(COALESCE(r.status, '')) != 'decaduta')
      AND (
        v_norm_types IS NULL 
        OR CASE
          WHEN r.is_f24 = TRUE THEN 'F24'
          WHEN r.is_quater = TRUE AND EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%RIAM%'
          ) THEN 'RIAMMISSIONE_QUATER'
          WHEN r.is_quater = TRUE THEN 'ROTTAMAZIONE_QUATER'
          WHEN EXISTS (
            SELECT 1 FROM rateation_types rt 
            WHERE rt.id = r.type_id AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
          ) THEN 'PAGOPA'
          ELSE 'ALTRO'
        END = ANY(v_norm_types)
      )
    GROUP BY r.id, r.number, r.taxpayer_name, r.status, r.created_at, r.is_f24, r.is_quater, r.type_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.number), '[]'::jsonb)
  INTO v_details
  FROM (
    SELECT 
      id,
      number,
      type,
      status,
      taxpayer_name,
      total_cents::bigint,
      paid_cents::bigint,
      residual_cents::bigint,
      overdue_cents::bigint,
      installments_total::int,
      installments_paid::int,
      CASE 
        WHEN total_cents > 0 
        THEN ROUND((paid_cents::numeric / total_cents::numeric) * 100, 1)
        ELSE 0 
      END as completion_percent,
      created_at
    FROM rateation_installments
  ) t;

  -- ============================================================
  -- BUILD FINAL RESULT
  -- ============================================================
  v_result := jsonb_build_object(
    'meta', jsonb_build_object(
      'version', '3.1.0',
      'generated_at', NOW(),
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
    'kpis', v_kpis,
    'by_type', v_by_type,
    'by_status', v_by_status,
    'series', v_series,
    'details', v_details
  );

  RETURN v_result;
END;
$function$;