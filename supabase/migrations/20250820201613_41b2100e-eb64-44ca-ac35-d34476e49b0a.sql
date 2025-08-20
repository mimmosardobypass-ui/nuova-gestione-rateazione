-- Create the missing v_kpi_rateations view for total residual amount
-- Using only existing residual_amount_cents column
CREATE OR REPLACE VIEW public.v_kpi_rateations AS
SELECT
  COALESCE(SUM(residual_amount_cents), 0)::bigint AS residual_amount_cents
FROM public.rateations
WHERE status <> 'decaduta';

-- Update v_dashboard_decaduto view to ensure correct *_cents fields
CREATE OR REPLACE VIEW public.v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(residual_at_decadence_cents), 0)::bigint AS gross_decayed_cents,
  COALESCE(SUM((transferred_amount * 100)::bigint), 0)::bigint AS transferred_cents,
  (COALESCE(SUM(residual_at_decadence_cents), 0) - COALESCE(SUM((transferred_amount * 100)::bigint), 0))::bigint AS net_to_transfer_cents
FROM public.rateations
WHERE status = 'decaduta';