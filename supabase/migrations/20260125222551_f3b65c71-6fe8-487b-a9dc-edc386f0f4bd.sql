-- =====================================================
-- MIGRAZIONE: Sincronizza Viste KPI Header con Card Breakdown
-- =====================================================
-- Problema: Le viste v_kpi_* filtrano solo per status 'attiva'/'in_ritardo',
-- mentre le RPC get_kpi_*_by_type includono TUTTE le rateazioni.
-- Soluzione: Rimuovere il filtro status per allineare header e card.

-- 1. v_kpi_total_due_effective: TUTTO il dovuto (matching get_kpi_due_by_type)
CREATE OR REPLACE VIEW public.v_kpi_total_due_effective AS
SELECT COALESCE(SUM(i.amount_cents), 0)::numeric AS effective_total_due_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL;

-- 2. v_kpi_total_paid_effective: TUTTO il pagato (matching get_kpi_paid_by_type)
CREATE OR REPLACE VIEW public.v_kpi_total_paid_effective AS
SELECT COALESCE(SUM(i.amount_cents), 0)::numeric AS effective_total_paid_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL
  AND i.is_paid = TRUE;

-- 3. v_kpi_rateations_effective (residuo): TUTTO il non-pagato (matching get_kpi_residual_by_type)
CREATE OR REPLACE VIEW public.v_kpi_rateations_effective AS
SELECT COALESCE(SUM(i.amount_cents), 0)::numeric AS effective_residual_amount_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL
  AND COALESCE(i.is_paid, FALSE) = FALSE;

-- 4. v_kpi_rateations_overdue_effective (in ritardo): mantiene filtro per rate scadute attive
-- Questa vista ha senso solo per rateazioni ancora aperte
CREATE OR REPLACE VIEW public.v_kpi_rateations_overdue_effective AS
SELECT COALESCE(SUM(
  CASE 
    WHEN i.is_paid = FALSE AND i.due_date < CURRENT_DATE 
    THEN i.amount_cents 
    ELSE 0 
  END
), 0)::numeric AS effective_overdue_amount_cents
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND i.canceled_at IS NULL
  AND (
    UPPER(r.status) IN ('ATTIVA', 'IN_RITARDO')
    OR (r.is_f24 = TRUE AND UPPER(r.status) = 'DECADUTA')
  );