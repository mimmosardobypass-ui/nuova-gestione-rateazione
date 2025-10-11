-- ========================================
-- STATISTICHE DASHBOARD - Ripristino Completo
-- ========================================

-- 1. Estensione unaccent (ricerca senza accenti)
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- 2. Vista di normalizzazione
CREATE OR REPLACE VIEW public.v_rateations_stats_source AS
SELECT
  r.id,
  rt.name AS type,
  LOWER(r.status) AS status,
  (r.paid_amount_cents + r.residual_amount_cents) AS total_amount_cents,
  r.paid_amount_cents,
  r.residual_amount_cents,
  r.overdue_amount_cents,
  r.taxpayer_name,
  r.owner_uid,
  r.created_at
FROM public.rateations r
JOIN public.rateation_types rt ON rt.id = r.type_id;

-- 3. Indici per performance
CREATE INDEX IF NOT EXISTS idx_rateations_created_at ON public.rateations (created_at);
CREATE INDEX IF NOT EXISTS idx_rateations_type_id ON public.rateations (type_id);
CREATE INDEX IF NOT EXISTS idx_rateations_status ON public.rateations (status);
CREATE INDEX IF NOT EXISTS idx_rateations_owner ON public.rateations (owner_uid);

-- 4. RPC get_filtered_stats (robusta, sempre ritorna JSON completo)
CREATE OR REPLACE FUNCTION public.get_filtered_stats(
  p_start_date DATE,
  p_end_date DATE,
  p_types TEXT[],
  p_statuses TEXT[],
  p_taxpayer_search TEXT,
  p_owner_only BOOLEAN,
  p_include_closed BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_by_type JSONB := '[]'::jsonb;
  v_by_status JSONB := '[]'::jsonb;
  v_by_taxpayer JSONB := '[]'::jsonb;
  v_kpi_total BIGINT := 0;
  v_kpi_residual BIGINT := 0;
  v_kpi_paid BIGINT := 0;
  v_kpi_overdue BIGINT := 0;
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
      AND (NOT p_owner_only OR s.owner_uid = v_uid)
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type_label', b.type,
        'count', COUNT(*),
        'total_amount_cents', COALESCE(SUM(b.total_amount_cents), 0),
        'paid_amount_cents', COALESCE(SUM(b.paid_amount_cents), 0),
        'residual_amount_cents', COALESCE(SUM(b.residual_amount_cents), 0),
        'overdue_amount_cents', COALESCE(SUM(b.overdue_amount_cents), 0)
      ) ORDER BY b.type)
      FROM base b
      GROUP BY b.type
    ), '[]'::jsonb),

    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'status', b.status,
        'count', COUNT(*),
        'total_amount_cents', COALESCE(SUM(b.total_amount_cents), 0),
        'paid_amount_cents', COALESCE(SUM(b.paid_amount_cents), 0),
        'residual_amount_cents', COALESCE(SUM(b.residual_amount_cents), 0),
        'overdue_amount_cents', COALESCE(SUM(b.overdue_amount_cents), 0)
      ) ORDER BY b.status)
      FROM base b
      GROUP BY b.status
    ), '[]'::jsonb),

    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'taxpayer_name', COALESCE(b.taxpayer_name, '(Sconosciuto)'),
        'count', COUNT(*),
        'total_amount_cents', COALESCE(SUM(b.total_amount_cents), 0),
        'paid_amount_cents', COALESCE(SUM(b.paid_amount_cents), 0),
        'residual_amount_cents', COALESCE(SUM(b.residual_amount_cents), 0),
        'overdue_amount_cents', COALESCE(SUM(b.overdue_amount_cents), 0)
      ) ORDER BY COALESCE(b.taxpayer_name, '') NULLS LAST)
      FROM base b
      GROUP BY b.taxpayer_name
    ), '[]'::jsonb),

    COALESCE((SELECT SUM(b.total_amount_cents) FROM base b), 0),
    COALESCE((SELECT SUM(b.residual_amount_cents) FROM base b), 0),
    COALESCE((SELECT SUM(b.paid_amount_cents) FROM base b), 0),
    COALESCE((SELECT SUM(b.overdue_amount_cents) FROM base b), 0)
  INTO v_by_type, v_by_status, v_by_taxpayer, v_kpi_total, v_kpi_residual, v_kpi_paid, v_kpi_overdue;

  RETURN jsonb_build_object(
    'by_type', v_by_type,
    'by_status', v_by_status,
    'by_taxpayer', v_by_taxpayer,
    'kpi_total_amount_cents', v_kpi_total,
    'kpi_residual_amount_cents', v_kpi_residual,
    'kpi_paid_amount_cents', v_kpi_paid,
    'kpi_overdue_amount_cents', v_kpi_overdue
  );
END;
$$;

-- 5. Grant per get_filtered_stats
REVOKE ALL ON FUNCTION public.get_filtered_stats(DATE,DATE,TEXT[],TEXT[],TEXT,BOOLEAN,BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.get_filtered_stats(DATE,DATE,TEXT[],TEXT[],TEXT,BOOLEAN,BOOLEAN) TO anon, authenticated, service_role;

-- 6. Drop e ricrea get_residual_detail (aggiornata per usare vista)
DROP FUNCTION IF EXISTS public.get_residual_detail(DATE,DATE,TEXT[],TEXT[],TEXT,BOOLEAN);

CREATE FUNCTION public.get_residual_detail(
  p_start_date DATE,
  p_end_date DATE,
  p_type_labels TEXT[],
  p_statuses TEXT[],
  p_taxpayer_search TEXT,
  p_owner_only BOOLEAN
) RETURNS TABLE (
  id BIGINT,
  number TEXT,
  taxpayer_name TEXT,
  type_label TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  residual_amount_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    r.number,
    s.taxpayer_name,
    s.type AS type_label,
    s.status,
    s.created_at,
    s.residual_amount_cents
  FROM public.v_rateations_stats_source s
  JOIN public.rateations r ON r.id = s.id
  WHERE s.residual_amount_cents > 0
    AND (p_start_date IS NULL OR s.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR s.created_at::date <= p_end_date)
    AND (p_type_labels IS NULL OR s.type = ANY(p_type_labels))
    AND (p_statuses IS NULL OR s.status = ANY(p_statuses))
    AND (p_taxpayer_search IS NULL OR p_taxpayer_search = '' OR
         unaccent(COALESCE(s.taxpayer_name,'')) ILIKE unaccent('%'||p_taxpayer_search||'%'))
    AND (NOT p_owner_only OR s.owner_uid = auth.uid())
  ORDER BY s.residual_amount_cents DESC;
END;
$$;

-- 7. Grant per get_residual_detail
GRANT EXECUTE ON FUNCTION public.get_residual_detail(DATE,DATE,TEXT[],TEXT[],TEXT,BOOLEAN) TO anon, authenticated, service_role;