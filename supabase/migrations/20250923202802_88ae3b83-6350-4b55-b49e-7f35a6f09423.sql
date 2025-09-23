-- Fix v_kpi_rateations_effective view - remove auth.uid() filter
-- RLS will be handled by the underlying v_rateations_with_kpis view
CREATE OR REPLACE VIEW v_kpi_rateations_effective AS
SELECT 
  COALESCE(SUM(residual_effective_cents), 0) AS effective_residual_amount_cents
FROM v_rateations_with_kpis;