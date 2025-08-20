-- Payment Data Normalization and Consistency Migration
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

-- 1.4 Fix views to use is_paid consistently (never paid_at/paid_date for payment status)

-- Update v_dashboard_decaduto to use is_paid only
CREATE OR REPLACE VIEW public.v_dashboard_decaduto AS
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

-- Update v_decadute_dettaglio to use is_paid only
CREATE OR REPLACE VIEW public.v_decadute_dettaglio AS
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

-- Ensure v_installments_effective uses is_paid as primary indicator
CREATE OR REPLACE VIEW public.v_installments_effective AS
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

-- Add audit table for payment operations (optional but useful)
CREATE TABLE IF NOT EXISTS public.installment_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id bigint NOT NULL,
  rateation_id bigint NOT NULL,
  user_uid uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for audit table
ALTER TABLE public.installment_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own audit records" ON public.installment_audit
  FOR SELECT USING (user_uid = auth.uid());

-- Audit trigger for payment cancellations
CREATE OR REPLACE FUNCTION public.audit_payment_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Log when payment status changes
  IF OLD.is_paid != NEW.is_paid THEN
    INSERT INTO public.installment_audit (
      installment_id, 
      rateation_id, 
      action, 
      old_values, 
      new_values
    ) VALUES (
      NEW.id,
      NEW.rateation_id,
      CASE WHEN NEW.is_paid THEN 'payment_marked' ELSE 'payment_cancelled' END,
      jsonb_build_object(
        'is_paid', OLD.is_paid,
        'paid_at', OLD.paid_at,
        'payment_mode', OLD.payment_mode,
        'paid_total_cents', OLD.paid_total_cents
      ),
      jsonb_build_object(
        'is_paid', NEW.is_paid,
        'paid_at', NEW.paid_at,
        'payment_mode', NEW.payment_mode,
        'paid_total_cents', NEW.paid_total_cents
      )
    );
  END IF;
  
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_payment_changes ON public.installments;
CREATE TRIGGER trg_audit_payment_changes
  AFTER UPDATE OF is_paid ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_payment_changes();