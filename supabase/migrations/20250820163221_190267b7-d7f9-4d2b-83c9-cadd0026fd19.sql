-- Payment Data Normalization and Consistency Migration (Fixed)
-- Phase 1: Data Cleanup - One-time fix for inconsistent installment records

-- 1.1 Clean up inconsistent data where is_paid = false but payment fields are populated
UPDATE public.installments
SET paid_at = NULL,
    paid_date = NULL,
    payment_mode = NULL,
    paid_total_cents = 0,
    penalty_amount_cents = 0,
    interest_amount_cents = 0,
    extra_interest_euro = 0,
    extra_penalty_euro = 0,
    late_days = NULL,
    paid_recorded_at = NULL
WHERE is_paid = false
  AND (paid_at IS NOT NULL 
       OR paid_date IS NOT NULL 
       OR payment_mode IS NOT NULL
       OR paid_total_cents != 0
       OR penalty_amount_cents != 0
       OR interest_amount_cents != 0
       OR extra_interest_euro != 0
       OR extra_penalty_euro != 0);

-- 1.2 Create normalization trigger to prevent future inconsistencies
CREATE OR REPLACE FUNCTION public.fn_normalize_paid_fields()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- If installment is NOT paid, clear ALL payment-related fields
  IF NEW.is_paid = false THEN
    NEW.paid_at := NULL;
    NEW.paid_date := NULL;
    NEW.payment_mode := NULL;
    NEW.paid_total_cents := 0;
    NEW.penalty_amount_cents := 0;
    NEW.interest_amount_cents := 0;
    NEW.extra_interest_euro := 0;
    NEW.extra_penalty_euro := 0;
    NEW.late_days := NULL;
    NEW.paid_recorded_at := NULL;
  END IF;
  
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_paid_fields ON public.installments;
CREATE TRIGGER trg_normalize_paid_fields
  BEFORE INSERT OR UPDATE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_paid_fields();

-- 1.3 Enhanced atomic payment cancellation function
CREATE OR REPLACE FUNCTION public.installment_cancel_payment(
  p_installment_id bigint,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rateation_id bigint;
  v_owner_uid uuid;
BEGIN
  -- Security check and get rateation info
  SELECT i.rateation_id, i.owner_uid 
  INTO v_rateation_id, v_owner_uid
  FROM public.installments i
  WHERE i.id = p_installment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  
  IF v_owner_uid != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Clear all payment fields atomically (trigger will also normalize)
  UPDATE public.installments
  SET is_paid = false,
      paid_at = NULL,
      paid_date = NULL,
      payment_mode = NULL,
      paid_total_cents = 0,
      penalty_amount_cents = 0,
      interest_amount_cents = 0,
      extra_interest_euro = 0,
      extra_penalty_euro = 0,
      late_days = NULL,
      paid_recorded_at = NULL
  WHERE id = p_installment_id;

  -- Recalculate rateation totals if function exists
  BEGIN
    PERFORM public.recompute_rateation_caches(v_rateation_id);
  EXCEPTION WHEN undefined_function THEN
    -- Function doesn't exist, skip recalculation
    NULL;
  END;
END $$;

GRANT EXECUTE ON FUNCTION public.installment_cancel_payment(bigint, text) TO authenticated;

-- 1.4 Fix views to use is_paid consistently (drop and recreate to avoid type conflicts)

-- Drop existing views to avoid column type conflicts
DROP VIEW IF EXISTS public.v_dashboard_decaduto CASCADE;
DROP VIEW IF EXISTS public.v_decadute_dettaglio CASCADE;

-- Recreate v_dashboard_decaduto with consistent is_paid logic
CREATE VIEW public.v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(
    CASE WHEN r.status = 'decaduta' AND i.is_paid = false 
    THEN i.amount 
    ELSE 0 END
  ), 0) as gross_decayed,
  
  COALESCE(SUM(
    CASE WHEN r.status = 'decaduta' AND r.transferred_amount > 0 
    THEN r.transferred_amount 
    ELSE 0 END
  ), 0) as transferred,
  
  COALESCE(SUM(
    CASE WHEN r.status = 'decaduta' AND i.is_paid = false 
    THEN i.amount 
    ELSE 0 END
  ) - SUM(
    CASE WHEN r.status = 'decaduta' AND r.transferred_amount > 0 
    THEN r.transferred_amount 
    ELSE 0 END
  ), 0) as net_to_transfer

FROM public.rateations r
LEFT JOIN public.installments i ON i.rateation_id = r.id
WHERE r.owner_uid = auth.uid() AND r.is_f24 = true;

-- Recreate v_decadute_dettaglio with consistent is_paid logic
CREATE VIEW public.v_decadute_dettaglio AS
SELECT
  r.id,
  r.number,
  r.taxpayer_name,
  r.decadence_at,
  COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount ELSE 0 END), 0) as residual_at_decadence,
  r.transferred_amount,
  COALESCE(SUM(CASE WHEN i.is_paid = false THEN i.amount ELSE 0 END), 0) - r.transferred_amount as to_transfer,
  r.replaced_by_rateation_id
FROM public.rateations r
LEFT JOIN public.installments i ON i.rateation_id = r.id
WHERE r.owner_uid = auth.uid() 
  AND r.is_f24 = true 
  AND r.status = 'decaduta'
GROUP BY r.id, r.number, r.taxpayer_name, r.decadence_at, r.transferred_amount, r.replaced_by_rateation_id;

-- Update v_installments_effective to use is_paid as primary indicator
DROP VIEW IF EXISTS public.v_installments_effective CASCADE;
CREATE VIEW public.v_installments_effective AS
SELECT 
  i.*,
  r.status as rateation_status,
  CASE 
    WHEN r.status = 'decaduta' AND i.is_paid = false THEN 'decayed'
    WHEN i.is_paid = true THEN 'paid'
    WHEN i.is_paid = false AND i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END as effective_status
FROM public.installments i
JOIN public.rateations r ON r.id = i.rateation_id
WHERE i.owner_uid = auth.uid();