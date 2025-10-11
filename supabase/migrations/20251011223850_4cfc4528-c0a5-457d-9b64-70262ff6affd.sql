-- Advanced Stats V2: Vista, Indici e RPC completa
-- Parte 1: Estensioni e Vista Sorgente V2

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Vista sorgente dedicata V2 con ref_date per raggruppamento flessibile
CREATE OR REPLACE VIEW public.v_rateations_stats_source_v2 AS
SELECT
  r.id,
  CASE 
    WHEN rt.name ILIKE '%F24%' THEN 'F24'
    WHEN rt.name ILIKE '%PAGOPA%' THEN 'PAGOPA'
    WHEN rt.name ILIKE '%ROTTAMAZIONE%QUATER%' THEN 'ROTTAMAZIONE_QUATER'
    WHEN rt.name ILIKE '%RIAM%QUATER%' OR rt.name ILIKE '%RIAMMISSIONE%QUATER%' THEN 'RIAMMISSIONE_QUATER'
    ELSE 'ALTRO'
  END AS type,
  LOWER(COALESCE(r.status, 'attiva')) AS status,
  COALESCE((r.total_amount * 100)::bigint, 0) AS total_amount_cents,
  COALESCE(r.residual_amount_cents, 0) AS residual_amount_cents,
  COALESCE(r.paid_amount_cents, 0) AS paid_amount_cents,
  r.taxpayer_name,
  r.owner_uid AS owner_id,
  r.created_at,
  COALESCE(r.start_due_date, r.created_at::date) AS ref_date
FROM public.rateations r
LEFT JOIN public.rateation_types rt ON rt.id = r.type_id;

-- Parte 2: Indici ottimizzati V2 (idempotenti)
CREATE INDEX IF NOT EXISTS idx_rateations_v2_created_at ON public.rateations (created_at);
CREATE INDEX IF NOT EXISTS idx_rateations_v2_start_due_date ON public.rateations (start_due_date);
CREATE INDEX IF NOT EXISTS idx_rateations_v2_status ON public.rateations (status);
CREATE INDEX IF NOT EXISTS idx_rateations_v2_owner_uid ON public.rateations (owner_uid);
CREATE INDEX IF NOT EXISTS idx_rateations_v2_taxpayer_name ON public.rateations USING gin(to_tsvector('simple', COALESCE(taxpayer_name, '')));

-- Parte 3: RPC get_advanced_stats_v2
CREATE OR REPLACE FUNCTION public.get_advanced_stats_v2(
  p_start_date date,
  p_end_date date,
  p_types text[],
  p_statuses text[],
  p_taxpayer_search text,
  p_owner_only boolean,
  p_include_closed boolean,
  p_group_by text DEFAULT 'ref'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group_by text := LOWER(COALESCE(p_group_by, 'ref'));
  v_errors jsonb := '[]'::jsonb;
  v_kpi jsonb := '{}'::jsonb;
  v_by_type jsonb := '[]'::jsonb;
  v_by_status jsonb := '[]'::jsonb;
  v_by_taxpayer jsonb := '[]'::jsonb;
  v_top_taxpayers jsonb := '[]'::jsonb;
  v_series_monthly jsonb := '[]'::jsonb;
BEGIN
  -- Validazioni input
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
    v_errors := v_errors || jsonb_build_array('Invalid period: end_date < start_date');
  END IF;
  
  IF v_group_by NOT IN ('ref', 'created') THEN
    v_errors := v_errors || jsonb_build_array('Invalid group_by: use "ref" or "created"');
    v_group_by := 'ref';
  END IF;

  -- CTE principale con filtri
  WITH base AS (
    SELECT 
      s.*,
      CASE 
        WHEN v_group_by = 'created' THEN s.created_at::date 
        ELSE s.ref_date 
      END AS grp_date
    FROM public.v_rateations_stats_source_v2 s
    WHERE (p_start_date IS NULL OR 
           (CASE WHEN v_group_by = 'created' THEN s.created_at::date ELSE s.ref_date END) >= p_start_date)
      AND (p_end_date IS NULL OR 
           (CASE WHEN v_group_by = 'created' THEN s.created_at::date ELSE s.ref_date END) <= p_end_date)
      AND (p_types IS NULL OR s.type = ANY(p_types))
      AND (p_statuses IS NULL OR s.status = ANY(p_statuses))
      AND (p_taxpayer_search IS NULL OR p_taxpayer_search = '' OR
           unaccent(COALESCE(s.taxpayer_name, '')) ILIKE unaccent('%' || p_taxpayer_search || '%'))
      AND (NOT p_owner_only OR s.owner_id = v_uid)
  ),
  kpi AS (
    SELECT
      COALESCE(SUM(total_amount_cents), 0)::bigint AS total_amount_cents,
      COALESCE(SUM(residual_amount_cents), 0)::bigint AS residual_amount_cents,
      COALESCE(SUM(paid_amount_cents), 0)::bigint AS paid_amount_cents
    FROM base
  ),
  by_type AS (
    SELECT 
      type AS type_label,
      COALESCE(SUM(total_amount_cents), 0)::bigint AS total_amount_cents
    FROM base
    GROUP BY type
  ),
  by_status AS (
    SELECT 
      status,
      COUNT(*)::bigint AS count
    FROM base
    GROUP BY status
  ),
  by_taxpayer AS (
    SELECT 
      taxpayer_name,
      COALESCE(SUM(total_amount_cents), 0)::bigint AS amount_cents,
      COUNT(*)::bigint AS count
    FROM base
    GROUP BY taxpayer_name
  ),
  top_taxpayers AS (
    SELECT 
      taxpayer_name,
      COALESCE(SUM(total_amount_cents), 0)::bigint AS amount_cents,
      COUNT(*)::bigint AS count
    FROM base
    GROUP BY taxpayer_name
    ORDER BY amount_cents DESC NULLS LAST
    LIMIT 10
  ),
  months AS (
    SELECT generate_series(
      date_trunc('month', COALESCE(p_start_date, (SELECT MIN(grp_date) FROM base))),
      date_trunc('month', COALESCE(p_end_date, (SELECT MAX(grp_date) FROM base))),
      interval '1 month'
    )::date AS month_start
  ),
  series AS (
    SELECT 
      m.month_start,
      b.type,
      COALESCE(SUM(b.total_amount_cents), 0)::bigint AS total_amount_cents
    FROM months m
    LEFT JOIN base b ON date_trunc('month', b.grp_date) = date_trunc('month', m.month_start)
    GROUP BY m.month_start, b.type
  )
  SELECT
    (SELECT jsonb_build_object(
       'total_amount_cents', k.total_amount_cents,
       'residual_amount_cents', k.residual_amount_cents,
       'paid_amount_cents', k.paid_amount_cents
     ) FROM kpi k),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'type_label', t.type_label, 
      'total_amount_cents', t.total_amount_cents
    ) ORDER BY t.type_label) FROM by_type t), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'status', s.status, 
      'count', s.count
    ) ORDER BY s.status) FROM by_status s), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'taxpayer_name', x.taxpayer_name, 
      'amount_cents', x.amount_cents, 
      'count', x.count
    ) ORDER BY COALESCE(x.taxpayer_name, '') NULLS LAST) FROM by_taxpayer x), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'taxpayer_name', x.taxpayer_name, 
      'amount_cents', x.amount_cents, 
      'count', x.count
    )) FROM top_taxpayers x), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'month', to_char(s.month_start, 'YYYY-MM'), 
      'type_label', s.type, 
      'total_amount_cents', s.total_amount_cents
    ) ORDER BY to_char(s.month_start, 'YYYY-MM'), s.type) FROM series s), '[]'::jsonb)
  INTO v_kpi, v_by_type, v_by_status, v_by_taxpayer, v_top_taxpayers, v_series_monthly;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'version', 'v2',
      'group_by', v_group_by,
      'generated_at', NOW()
    ),
    'inputs_echo', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'types', p_types,
      'statuses', p_statuses,
      'taxpayer_search', p_taxpayer_search,
      'owner_only', p_owner_only,
      'include_closed', p_include_closed
    ),
    'kpi', v_kpi,
    'by_type', v_by_type,
    'by_status', v_by_status,
    'by_taxpayer', v_by_taxpayer,
    'top_taxpayers', v_top_taxpayers,
    'series_monthly', v_series_monthly,
    'errors', v_errors
  );
END;
$$;

-- Grant esecuzione
REVOKE ALL ON FUNCTION public.get_advanced_stats_v2(date,date,text[],text[],text,boolean,boolean,text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_advanced_stats_v2(date,date,text[],text[],text,boolean,boolean,text) TO anon, authenticated, service_role;