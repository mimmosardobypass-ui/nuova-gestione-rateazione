-- Update v_kpi_rateations view with COALESCE for always 1 row and security_invoker
CREATE OR REPLACE VIEW public.v_kpi_rateations AS
SELECT
  COALESCE(
    SUM(
      COALESCE(r.residual_amount_cents,
               ROUND(COALESCE(r.residual_amount, 0) * 100)
      )
    )
  , 0)::bigint AS residual_amount_cents
FROM public.rateations r
WHERE COALESCE(r.status, 'active') <> 'decaduta';

-- Set security_invoker for RLS to apply at query time
ALTER VIEW public.v_kpi_rateations SET (security_invoker = on);

-- Add performance index for status filtering
CREATE INDEX IF NOT EXISTS rateations_status_idx ON public.rateations(status);