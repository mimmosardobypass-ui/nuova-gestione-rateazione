
-- ==================================================================
-- FIX: Corregge le RPC per usare il totale calcolato correttamente
-- Problema: le RPC cercavano r.total_amount_cents che non esiste
-- Soluzione: usare (r.paid_amount_cents + r.residual_amount_cents)
-- ==================================================================

-- 1) Ricrea get_filtered_stats con il calcolo corretto del totale
DROP FUNCTION IF EXISTS public.get_filtered_stats(
  date, date, text[], text[], text, boolean
) CASCADE;

CREATE OR REPLACE FUNCTION public.get_filtered_stats(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_uid uuid;
  v_result jsonb;
BEGIN
  v_owner_uid := auth.uid();
  IF v_owner_uid IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;

  SELECT jsonb_build_object(
    'by_status', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT 
          r.status,
          COUNT(*)::int as count,
          ((SUM(r.paid_amount_cents + r.residual_amount_cents))::bigint) as total_amount_cents,
          (SUM(r.paid_amount_cents)::bigint) as paid_amount_cents,
          (SUM(r.residual_amount_cents)::bigint) as residual_amount_cents,
          (SUM(r.overdue_amount_cents)::bigint) as overdue_amount_cents
        FROM rateations r
        JOIN v_rateation_type_label vtl ON r.id = vtl.id
        WHERE r.owner_uid = v_owner_uid
          AND (p_start_date IS NULL OR r.created_at::date >= p_start_date)
          AND (p_end_date IS NULL OR r.created_at::date <= p_end_date)
          AND (p_type_labels IS NULL OR vtl.type_label = ANY(public.norm_upper_arr(p_type_labels)))
          AND (p_statuses IS NULL OR LOWER(r.status) = ANY(public.norm_lower_arr(p_statuses)))
          AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
        GROUP BY r.status
      ) t
    ),
    'by_taxpayer', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT 
          r.taxpayer_name,
          COUNT(*)::int as count,
          ((SUM(r.paid_amount_cents + r.residual_amount_cents))::bigint) as total_amount_cents,
          (SUM(r.paid_amount_cents)::bigint) as paid_amount_cents,
          (SUM(r.residual_amount_cents)::bigint) as residual_amount_cents,
          (SUM(r.overdue_amount_cents)::bigint) as overdue_amount_cents
        FROM rateations r
        JOIN v_rateation_type_label vtl ON r.id = vtl.id
        WHERE r.owner_uid = v_owner_uid
          AND (p_start_date IS NULL OR r.created_at::date >= p_start_date)
          AND (p_end_date IS NULL OR r.created_at::date <= p_end_date)
          AND (p_type_labels IS NULL OR vtl.type_label = ANY(public.norm_upper_arr(p_type_labels)))
          AND (p_statuses IS NULL OR LOWER(r.status) = ANY(public.norm_lower_arr(p_statuses)))
          AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
        GROUP BY r.taxpayer_name
        ORDER BY SUM(r.residual_amount_cents) DESC
      ) t
    ),
    'cashflow', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT 
          i.due_date,
          DATE_TRUNC('month', i.due_date)::date as month,
          (SUM(i.amount * 100)::bigint) as due_amount_cents,
          (SUM(CASE WHEN i.is_paid THEN i.amount * 100 ELSE 0 END)::bigint) as paid_amount_cents
        FROM installments i
        JOIN rateations r ON i.rateation_id = r.id
        JOIN v_rateation_type_label vtl ON r.id = vtl.id
        WHERE r.owner_uid = v_owner_uid
          AND (p_start_date IS NULL OR i.due_date >= p_start_date)
          AND (p_end_date IS NULL OR i.due_date <= p_end_date)
          AND (p_type_labels IS NULL OR vtl.type_label = ANY(public.norm_upper_arr(p_type_labels)))
          AND (p_statuses IS NULL OR LOWER(r.status) = ANY(public.norm_lower_arr(p_statuses)))
          AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
        GROUP BY DATE_TRUNC('month', i.due_date), i.due_date
        ORDER BY month
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_stats(date, date, text[], text[], text, boolean) TO authenticated;
COMMENT ON FUNCTION public.get_filtered_stats IS 'v2024-10-11-fix-total-cents: Fixed total_amount_cents calculation';

-- 2) Ricrea stats_per_tipologia_effective con il calcolo corretto
DROP FUNCTION IF EXISTS public.stats_per_tipologia_effective(
  date, date, text[], text[], boolean
) CASCADE;

CREATE OR REPLACE FUNCTION public.stats_per_tipologia_effective(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_type_labels text[] DEFAULT NULL,
  p_include_closed boolean DEFAULT false
)
RETURNS TABLE(
  type_label text,
  count bigint,
  total_amount_cents bigint,
  paid_amount_cents bigint,
  residual_amount_cents bigint,
  overdue_amount_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_uid uuid;
BEGIN
  v_owner_uid := auth.uid();
  IF v_owner_uid IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;

  RETURN QUERY
  SELECT 
    vtl.type_label,
    COUNT(DISTINCT r.id) as count,
    SUM(r.paid_amount_cents + r.residual_amount_cents)::bigint as total_amount_cents,
    SUM(r.paid_amount_cents)::bigint as paid_amount_cents,
    SUM(r.residual_amount_cents)::bigint as residual_amount_cents,
    SUM(r.overdue_amount_cents)::bigint as overdue_amount_cents
  FROM rateations r
  JOIN v_rateation_type_label vtl ON r.id = vtl.id
  WHERE r.owner_uid = v_owner_uid
    AND (p_start_date IS NULL OR r.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR r.created_at::date <= p_end_date)
    AND (p_type_labels IS NULL OR vtl.type_label = ANY(public.norm_upper_arr(p_type_labels)))
    AND (p_statuses IS NULL OR LOWER(r.status) = ANY(public.norm_lower_arr(p_statuses)))
    -- Escludi F24 collegate a PagoPA per evitare doppio conteggio
    AND NOT (r.is_f24 = true AND EXISTS (
      SELECT 1 FROM f24_pagopa_links fpl WHERE fpl.f24_id = r.id
    ))
  GROUP BY vtl.type_label
  ORDER BY vtl.type_label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stats_per_tipologia_effective(date, date, text[], text[], boolean) TO authenticated;
COMMENT ON FUNCTION public.stats_per_tipologia_effective IS 'v2024-10-11-fix-total-cents: Fixed total_amount_cents calculation';

-- 3) Ricrea get_residual_detail con il calcolo corretto
DROP FUNCTION IF EXISTS public.get_residual_detail(
  date, date, text[], text[], text, boolean
) CASCADE;

CREATE OR REPLACE FUNCTION public.get_residual_detail(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_type_labels text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_taxpayer_search text DEFAULT NULL,
  p_owner_only boolean DEFAULT false
)
RETURNS TABLE(
  id bigint,
  tipo text,
  taxpayer_name text,
  total_due_cents bigint,
  paid_cents bigint,
  residual_cents bigint,
  overdue_cents bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_uid uuid;
BEGIN
  v_owner_uid := auth.uid();
  IF v_owner_uid IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    rt.name as tipo,
    r.taxpayer_name,
    (r.paid_amount_cents + r.residual_amount_cents)::bigint as total_due_cents,
    r.paid_amount_cents::bigint as paid_cents,
    r.residual_amount_cents::bigint as residual_cents,
    r.overdue_amount_cents::bigint as overdue_cents,
    r.status
  FROM rateations r
  JOIN rateation_types rt ON r.type_id = rt.id
  JOIN v_rateation_type_label vtl ON r.id = vtl.id
  WHERE r.owner_uid = v_owner_uid
    AND r.residual_amount_cents > 0
    AND (p_start_date IS NULL OR r.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR r.created_at::date <= p_end_date)
    AND (p_type_labels IS NULL OR vtl.type_label = ANY(public.norm_upper_arr(p_type_labels)))
    AND (p_statuses IS NULL OR LOWER(r.status) = ANY(public.norm_lower_arr(p_statuses)))
    AND (p_taxpayer_search IS NULL OR r.taxpayer_name ILIKE '%' || p_taxpayer_search || '%')
  ORDER BY r.residual_amount_cents DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_residual_detail(date, date, text[], text[], text, boolean) TO authenticated;
COMMENT ON FUNCTION public.get_residual_detail IS 'v2024-10-11-fix-total-cents: Fixed total_amount_cents calculation';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
