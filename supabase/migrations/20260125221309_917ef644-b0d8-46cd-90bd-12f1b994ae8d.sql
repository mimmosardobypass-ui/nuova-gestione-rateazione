-- Allineare v_kpi_total_due_effective alla logica delle RPC (somma da installments)
CREATE OR REPLACE VIEW public.v_kpi_total_due_effective AS
SELECT
  COALESCE(SUM(i.amount_cents), 0) AS effective_total_due_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL
  AND (
    r.status IN ('attiva', 'in_ritardo')
    OR (r.is_f24 = TRUE AND r.status = 'DECADUTA')
  );

-- Allineare v_kpi_total_paid_effective alla logica delle RPC
CREATE OR REPLACE VIEW public.v_kpi_total_paid_effective AS
SELECT
  COALESCE(SUM(i.amount_cents), 0) AS effective_total_paid_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL
  AND i.is_paid = TRUE
  AND (
    r.status IN ('attiva', 'in_ritardo')
    OR (r.is_f24 = TRUE AND r.status = 'DECADUTA')
  );

-- Allineare v_kpi_rateations_effective (residuo) alla logica delle RPC
CREATE OR REPLACE VIEW public.v_kpi_rateations_effective AS
SELECT
  COALESCE(SUM(i.amount_cents), 0) AS effective_residual_amount_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL
  AND COALESCE(i.is_paid, FALSE) = FALSE
  AND (
    r.status IN ('attiva', 'in_ritardo')
    OR (r.is_f24 = TRUE AND r.status = 'DECADUTA')
  );