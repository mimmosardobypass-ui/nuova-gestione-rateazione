-- Vista per TOTALE DOVUTO (totale originale delle rateazioni "debito reale")
CREATE OR REPLACE VIEW public.v_kpi_total_due_effective AS
SELECT
  COALESCE(SUM((r.total_amount * 100)::bigint), 0) AS effective_total_due_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    -- CASO A: Rateazioni ATTIVE con residuo
    (r.residual_amount_cents > 0 
     AND r.status NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    -- CASO B: F24 DECADUTE in attesa di cartella
    (r.is_f24 = TRUE AND r.status = 'DECADUTA' AND r.residual_amount_cents > 0)
  );

-- Vista per TOTALE PAGATO (paid_amount_cents delle rateazioni "debito reale")
CREATE OR REPLACE VIEW public.v_kpi_total_paid_effective AS
SELECT
  COALESCE(SUM(r.paid_amount_cents), 0) AS effective_total_paid_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid()
  AND COALESCE(r.is_deleted, FALSE) = FALSE
  AND (
    -- CASO A: Rateazioni ATTIVE con residuo
    (r.residual_amount_cents > 0 
     AND r.status NOT IN ('COMPLETATA', 'DECADUTA', 'ESTINTA', 'INTERROTTA'))
    OR 
    -- CASO B: F24 DECADUTE in attesa di cartella
    (r.is_f24 = TRUE AND r.status = 'DECADUTA' AND r.residual_amount_cents > 0)
  );