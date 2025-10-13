-- =====================================================================
-- RPC: public.stats_v2
-- Firma identica al frontend: (p_date_from, p_date_to, p_group_by, 
-- p_include_interrupted, p_owner, p_status, p_types)
-- Returns: JSONB {totals, by_type, series}
-- =====================================================================

CREATE OR REPLACE FUNCTION public.stats_v2(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_group_by text DEFAULT 'due',
  p_include_interrupted boolean DEFAULT FALSE,
  p_owner uuid DEFAULT NULL,
  p_status text[] DEFAULT NULL,
  p_types text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT
    s.id,
    s.type,
    LOWER(COALESCE(s.status, 'attiva')) AS status,
    s.total_amount_cents,
    s.residual_amount_cents,
    s.paid_amount_cents,
    s.owner_id,
    s.created_at::date AS created_date,
    s.ref_date
  FROM public.v_rateations_stats_source_v2 s
  WHERE (p_owner IS NULL OR s.owner_id = p_owner)
    AND (p_types IS NULL OR s.type = ANY(p_types))
    AND (
      (p_status IS NOT NULL AND array_length(p_status, 1) > 0 AND s.status = ANY(p_status))
      OR (p_status IS NULL AND (CASE WHEN p_include_interrupted THEN TRUE ELSE s.status = 'attiva' END))
    )
    AND (
      CASE WHEN p_group_by = 'created'
        THEN (p_date_from IS NULL OR s.created_at >= p_date_from)
         AND (p_date_to IS NULL OR s.created_at < p_date_to + 1)
        ELSE (p_date_from IS NULL OR s.ref_date >= p_date_from)
         AND (p_date_to IS NULL OR s.ref_date < p_date_to + 1)
      END
    )
),
totals AS (
  SELECT
    COALESCE(SUM(total_amount_cents), 0) AS total_cents,
    COALESCE(SUM(residual_amount_cents), 0) AS residual_cents,
    COALESCE(SUM(paid_amount_cents), 0) AS paid_cents
  FROM base
),
by_type AS (
  SELECT
    type,
    COALESCE(SUM(total_amount_cents), 0) AS total_cents,
    COALESCE(SUM(residual_amount_cents), 0) AS residual_cents,
    COALESCE(SUM(paid_amount_cents), 0) AS paid_cents
  FROM base
  GROUP BY type
  ORDER BY type
),
series AS (
  SELECT
    DATE_TRUNC('month',
      CASE WHEN p_group_by = 'created' THEN created_date ELSE ref_date END
    )::date AS m,
    COALESCE(SUM(total_amount_cents), 0) AS total_cents,
    COALESCE(SUM(residual_amount_cents), 0) AS residual_cents,
    COALESCE(SUM(paid_amount_cents), 0) AS paid_cents
  FROM base
  GROUP BY 1
  ORDER BY 1
)
SELECT jsonb_build_object(
  'totals', jsonb_build_object(
    'total_cents', (SELECT total_cents FROM totals),
    'residual_cents', (SELECT residual_cents FROM totals),
    'paid_cents', (SELECT paid_cents FROM totals)
  ),
  'by_type', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'type', type,
          'total_cents', total_cents,
          'residual_cents', residual_cents,
          'paid_cents', paid_cents
        ) ORDER BY type
      ),
      '[]'::jsonb
    )
    FROM by_type
  ),
  'series', (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'month', m,
          'total_cents', total_cents,
          'residual_cents', residual_cents,
          'paid_cents', paid_cents
        ) ORDER BY m
      ),
      '[]'::jsonb
    )
    FROM series
  )
);
$$;

-- Revoke public access, grant to authenticated users
REVOKE ALL ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) TO authenticated, service_role;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_rateations_owner_status_type
  ON public.rateations(owner_uid, status, type_id)
  WHERE COALESCE(is_deleted, false) = false;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';