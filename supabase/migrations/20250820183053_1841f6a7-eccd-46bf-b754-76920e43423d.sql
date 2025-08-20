-- Drop and recreate views to fix data type changes
DROP VIEW IF EXISTS v_dashboard_decaduto_preview;
DROP VIEW IF EXISTS v_dashboard_decaduto;

-- 1.1 Fix vista preview (usa SOLO is_paid = false)
CREATE VIEW v_dashboard_decaduto_preview AS
SELECT
  COALESCE(SUM(i.amount_cents), 0)::bigint AS potential_gross_decayed_cents
FROM rateations r
JOIN installments i ON i.rateation_id = r.id
WHERE r.is_f24 = TRUE
  AND r.status IN ('active', 'decadence_pending')
  AND i.is_paid = FALSE
  AND (CURRENT_DATE - i.due_date::date) > 90;

-- 1.2 Fix vista dashboard (solo decadenze CONFERMATE, in cents)
CREATE VIEW v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(r.residual_at_decadence_cents), 0)::bigint AS gross_decayed_cents,
  COALESCE(SUM((r.transferred_amount * 100)::bigint), 0)::bigint AS transferred_cents,
  COALESCE(SUM(r.residual_at_decadence_cents), 0)::bigint
    - COALESCE(SUM((r.transferred_amount * 100)::bigint), 0)::bigint AS net_to_transfer_cents
FROM rateations r
WHERE r.status = 'decaduta';

-- 1.3 Enhanced installment payment cancellation function
CREATE OR REPLACE FUNCTION public.installment_cancel_payment_enhanced_v2(p_installment_id bigint, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  -- Complete cleanup: clear ALL payment-related fields
  UPDATE public.installments
  SET is_paid = FALSE,
      paid_at = NULL,
      paid_date = NULL,
      payment_mode = NULL,
      paid_total_cents = 0,
      penalty_amount_cents = 0,
      interest_amount_cents = 0,
      extra_interest_euro = 0,
      extra_penalty_euro = 0,
      late_days = NULL,
      paid_recorded_at = NULL,
      penalty_rule_id = NULL,
      interest_breakdown = NULL
  WHERE id = p_installment_id;

  -- Force recalculation of totals
  PERFORM rateations_recalc_totals(v_rateation_id);
END;
$function$;

-- 1.4 One-off cleanup: fix all inconsistent installment data
UPDATE installments
SET paid_at = NULL,
    paid_date = NULL,
    paid_total_cents = 0,
    payment_mode = NULL,
    penalty_amount_cents = 0,
    interest_amount_cents = 0,
    extra_interest_euro = 0,
    extra_penalty_euro = 0,
    late_days = NULL,
    paid_recorded_at = NULL,
    penalty_rule_id = NULL,
    interest_breakdown = NULL
WHERE is_paid = FALSE
  AND (paid_at IS NOT NULL 
       OR paid_date IS NOT NULL
       OR paid_total_cents <> 0
       OR COALESCE(penalty_amount_cents,0) <> 0
       OR COALESCE(interest_amount_cents,0) <> 0
       OR COALESCE(extra_interest_euro,0) <> 0
       OR COALESCE(extra_penalty_euro,0) <> 0);

-- Specific fix for installment #12 of plan "1F24" mentioned in the patch
UPDATE installments i
SET paid_at = NULL, 
    paid_date = NULL, 
    paid_total_cents = 0, 
    payment_mode = NULL,
    penalty_amount_cents = 0, 
    interest_amount_cents = 0,
    extra_interest_euro = 0, 
    extra_penalty_euro = 0,
    late_days = NULL,
    paid_recorded_at = NULL,
    penalty_rule_id = NULL,
    interest_breakdown = NULL
FROM rateations r
WHERE i.rateation_id = r.id
  AND r.number = '1F24'
  AND i.seq = 12
  AND i.is_paid = FALSE;

-- Force recalculation of all totals for safety
DO $$
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM rateations LOOP
    PERFORM rateations_recalc_totals(r.id);
  END LOOP;
END$$;