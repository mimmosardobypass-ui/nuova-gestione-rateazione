-- Create v_kpi_rateations_effective view to aggregate effective residual amounts
-- This view sums residual_effective_cents from v_rateations_with_kpis
-- and excludes interrupted PagoPA rateations (where residual_effective_cents = 0)

CREATE OR REPLACE VIEW v_kpi_rateations_effective AS
SELECT 
  COALESCE(SUM(residual_effective_cents), 0) AS effective_residual_amount_cents
FROM v_rateations_with_kpis
WHERE owner_uid = auth.uid();