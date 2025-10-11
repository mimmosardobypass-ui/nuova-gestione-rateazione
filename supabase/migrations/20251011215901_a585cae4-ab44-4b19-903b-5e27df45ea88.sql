-- Fix stats RPC with adaptive type mapping (v2)
-- Maps legacy types (Quater, Riam.Quater) to canonical types

-- 1. Enable unaccent extension for case-insensitive searches
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- 2. Drop old view completely to avoid column order issues
DROP VIEW IF EXISTS public.v_rateations_stats_source CASCADE;

-- 3. Create view with adaptive mapping and correct column order
CREATE VIEW public.v_rateations_stats_source AS
SELECT
  r.id,
  CASE 
    WHEN UPPER(COALESCE(rt.name, '')) = 'PAGOPA' THEN 'PAGOPA'
    WHEN UPPER(COALESCE(rt.name, '')) IN ('QUATER', 'ROTTAMAZIONE QUATER') THEN 'ROTTAMAZIONE_QUATER'
    WHEN UPPER(COALESCE(rt.name, '')) IN ('RIAM.QUATER', 'RIAMMISSIONE QUATER') THEN 'RIAMMISSIONE_QUATER'
    WHEN UPPER(COALESCE(rt.name, '')) = 'F24' THEN 'F24'
    ELSE 'ALTRO'
  END AS type,
  LOWER(COALESCE(r.status, 'attiva')) AS status,
  (r.total_amount * 100)::bigint AS total_amount_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_amount_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_amount_cents,
  COALESCE(r.overdue_amount_cents, 0) AS overdue_amount_cents,
  r.taxpayer_name,
  r.owner_uid AS owner_id,
  r.created_at
FROM public.rateations r
LEFT JOIN public.rateation_types rt ON rt.id = r.type_id;

-- 4. Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_rateations_created_at ON public.rateations (created_at);
CREATE INDEX IF NOT EXISTS idx_rateations_type_id ON public.rateations (type_id);
CREATE INDEX IF NOT EXISTS idx_rateations_status ON public.rateations (status);
CREATE INDEX IF NOT EXISTS idx_rateations_owner_uid ON public.rateations (owner_uid);

-- 5. Drop old function
DROP FUNCTION IF EXISTS public.get_filtered_stats(date,date,text[],text[],text,boolean,boolean);

-- 6. Create fixed RPC with explicit aggregations
CREATE FUNCTION public.get_filtered_stats(
  p_start_date date,
  p_end_date date,
  p_types text[],
  p_statuses text[],
  p_taxpayer_search text,
  p_owner_only boolean,
  p_include_closed boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_by_type jsonb := '[]'::jsonb;
  v_by_status jsonb := '[]'::jsonb;
  v_by_taxpayer jsonb := '[]'::jsonb;
  v_kpi_total bigint := 0;
  v_kpi_residual bigint := 0;
  v_kpi_paid bigint := 0;
  v_kpi_overdue bigint := 0;
BEGIN
  WITH base AS (
    SELECT s.*
    FROM public.v_rateations_stats_source s
    WHERE (p_start_date IS NULL OR s.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR s.created_at::date <= p_end_date)
      AND (p_types IS NULL OR s.type = ANY(p_types))
      AND (p_statuses IS NULL OR s.status = ANY(p_statuses))
      AND (p_taxpayer_search IS NULL OR p_taxpayer_search = '' OR
           unaccent(COALESCE(s.taxpayer_name,'')) ILIKE unaccent('%'||p_taxpayer_search||'%'))
      AND (NOT p_owner_only OR s.owner_id = v_uid)
  ),
  by_type AS (
    SELECT
      b.type AS type_label,
      COUNT(*)::bigint AS count,
      COALESCE(SUM(b.total_amount_cents),0)::bigint AS total_amount_cents,
      COALESCE(SUM(b.paid_amount_cents),0)::bigint AS paid_amount_cents,
      COALESCE(SUM(b.residual_amount_cents),0)::bigint AS residual_amount_cents,
      COALESCE(SUM(b.overdue_amount_cents),0)::bigint AS overdue_amount_cents
    FROM base b
    GROUP BY b.type
  ),
  by_status AS (
    SELECT
      b.status,
      COUNT(*)::bigint AS count,
      COALESCE(SUM(b.total_amount_cents),0)::bigint AS total_amount_cents,
      COALESCE(SUM(b.paid_amount_cents),0)::bigint AS paid_amount_cents,
      COALESCE(SUM(b.residual_amount_cents),0)::bigint AS residual_amount_cents,
      COALESCE(SUM(b.overdue_amount_cents),0)::bigint AS overdue_amount_cents
    FROM base b
    GROUP BY b.status
  ),
  by_taxpayer AS (
    SELECT
      b.taxpayer_name,
      COUNT(*)::bigint AS count,
      COALESCE(SUM(b.total_amount_cents),0)::bigint AS total_amount_cents,
      COALESCE(SUM(b.paid_amount_cents),0)::bigint AS paid_amount_cents,
      COALESCE(SUM(b.residual_amount_cents),0)::bigint AS residual_amount_cents,
      COALESCE(SUM(b.overdue_amount_cents),0)::bigint AS overdue_amount_cents
    FROM base b
    GROUP BY b.taxpayer_name
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'type_label', t.type_label,
          'count', t.count,
          'total_amount_cents', t.total_amount_cents,
          'paid_amount_cents', t.paid_amount_cents,
          'residual_amount_cents', t.residual_amount_cents,
          'overdue_amount_cents', t.overdue_amount_cents
        ) ORDER BY t.type_label
      )
      FROM by_type t
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'status', s.status,
          'count', s.count,
          'total_amount_cents', s.total_amount_cents,
          'paid_amount_cents', s.paid_amount_cents,
          'residual_amount_cents', s.residual_amount_cents,
          'overdue_amount_cents', s.overdue_amount_cents
        ) ORDER BY s.status
      )
      FROM by_status s
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'taxpayer_name', x.taxpayer_name,
          'count', x.count,
          'total_amount_cents', x.total_amount_cents,
          'paid_amount_cents', x.paid_amount_cents,
          'residual_amount_cents', x.residual_amount_cents,
          'overdue_amount_cents', x.overdue_amount_cents
        ) ORDER BY COALESCE(x.taxpayer_name,'') NULLS LAST
      )
      FROM by_taxpayer x
    ), '[]'::jsonb),
    COALESCE((SELECT SUM(b.total_amount_cents) FROM base b),0)::bigint,
    COALESCE((SELECT SUM(b.residual_amount_cents) FROM base b),0)::bigint,
    COALESCE((SELECT SUM(b.paid_amount_cents) FROM base b),0)::bigint,
    COALESCE((SELECT SUM(b.overdue_amount_cents) FROM base b),0)::bigint
  INTO v_by_type, v_by_status, v_by_taxpayer, v_kpi_total, v_kpi_residual, v_kpi_paid, v_kpi_overdue;

  RETURN jsonb_build_object(
    'by_type', v_by_type,
    'by_status', v_by_status,
    'by_taxpayer', v_by_taxpayer,
    'cashflow', '[]'::jsonb,
    'kpi_total_amount_cents', v_kpi_total,
    'kpi_residual_amount_cents', v_kpi_residual,
    'kpi_paid_amount_cents', v_kpi_paid,
    'kpi_overdue_amount_cents', v_kpi_overdue
  );
END;
$$;

-- 7. Grant permissions
REVOKE ALL ON FUNCTION public.get_filtered_stats(date,date,text[],text[],text,boolean,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_filtered_stats(date,date,text[],text[],text,boolean,boolean) TO anon, authenticated, service_role;