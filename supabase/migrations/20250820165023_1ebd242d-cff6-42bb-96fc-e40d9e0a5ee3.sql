-- Phase 1: Database Schema Enhancement
-- Add missing calculated amount columns to rateations table
ALTER TABLE rateations
  ADD COLUMN IF NOT EXISTS paid_amount_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residual_amount_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overdue_amount_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residual_at_decadence_cents bigint DEFAULT 0;

-- Phase 2: Enhanced Totals Management
-- Enhanced recompute function that calculates all amount fields
CREATE OR REPLACE FUNCTION public.recompute_rateation_caches(p_rateation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE rateations SET
    -- Existing total_amount calculation
    total_amount = COALESCE((
      SELECT SUM(amount)
      FROM installments i
      WHERE i.rateation_id = rateations.id
    ), 0),
    
    -- New calculated amount fields in cents
    paid_amount_cents = COALESCE((
      SELECT SUM(i.amount_cents)
      FROM installments i
      WHERE i.rateation_id = rateations.id AND i.is_paid = true
    ), 0),
    
    residual_amount_cents = COALESCE((
      SELECT SUM(i.amount_cents)
      FROM installments i
      WHERE i.rateation_id = rateations.id AND i.is_paid = false
    ), 0),
    
    overdue_amount_cents = COALESCE((
      SELECT SUM(i.amount_cents)
      FROM installments i
      WHERE i.rateation_id = rateations.id 
      AND i.is_paid = false 
      AND i.due_date < CURRENT_DATE
    ), 0)
  WHERE id = p_rateation_id;

  -- Trigger status recalculation
  PERFORM fn_recalc_rateation_status(p_rateation_id);
END;
$function$;

-- New robust totals recalculation function as per patch
CREATE OR REPLACE FUNCTION public.rateations_recalc_totals(p_rateation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE rateations r
  SET
    total_amount = COALESCE((
      SELECT SUM(i.amount) FROM installments i
      WHERE i.rateation_id = r.id
    ), 0),
    paid_amount_cents = COALESCE((
      SELECT SUM(i.amount_cents) FROM installments i
      WHERE i.rateation_id = r.id AND i.is_paid = true
    ), 0),
    residual_amount_cents = COALESCE((
      SELECT SUM(i.amount_cents) FROM installments i
      WHERE i.rateation_id = r.id AND i.is_paid = false
    ), 0),
    overdue_amount_cents = COALESCE((
      SELECT SUM(i.amount_cents) FROM installments i
      WHERE i.rateation_id = r.id AND i.is_paid = false AND i.due_date < CURRENT_DATE
    ), 0)
  WHERE r.id = p_rateation_id;
  
  -- Also trigger status recalculation
  PERFORM fn_recalc_rateation_status(p_rateation_id);
END;
$function$;

-- Phase 4: Trigger System Implementation
-- Trigger function for automatic recalculation
CREATE OR REPLACE FUNCTION public.trg_recalc_totals_installments()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_rateation_id bigint;
BEGIN
  v_rateation_id := COALESCE(NEW.rateation_id, OLD.rateation_id);
  PERFORM rateations_recalc_totals(v_rateation_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Drop and recreate trigger for installments
DROP TRIGGER IF EXISTS t_aiud_installments_recalc ON installments;
CREATE TRIGGER t_aiud_installments_recalc
  AFTER INSERT OR UPDATE OR DELETE ON installments
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_totals_installments();

-- Phase 3: Enhanced Decadence Management
-- Enhanced decadence confirmation function with snapshot
CREATE OR REPLACE FUNCTION public.rateation_confirm_decadence(
  p_rateation_id bigint, 
  p_installment_id bigint DEFAULT NULL, 
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_residual_cents bigint;
BEGIN
  -- Explicit ownership check
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_rateation_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Idempotency check
  IF (SELECT status FROM rateations WHERE id = p_rateation_id) = 'decaduta' THEN
    RETURN;
  END IF;

  -- Calculate residual from unpaid installments in cents
  SELECT COALESCE(SUM(i.amount_cents), 0)
  INTO v_residual_cents
  FROM installments i
  WHERE i.rateation_id = p_rateation_id
    AND i.is_paid = false;

  -- Update with snapshot
  UPDATE rateations
  SET status = 'decaduta',
      decadence_at = COALESCE(decadence_at, NOW()),
      decadence_installment_id = p_installment_id,
      decadence_reason = p_reason,
      decadence_confirmed_by = auth.uid(),
      residual_at_decadence = (v_residual_cents::numeric / 100.0),
      residual_at_decadence_cents = v_residual_cents
  WHERE id = p_rateation_id;
END;
$function$;

-- Enhanced decadence dashboard view using snapshots
CREATE OR REPLACE VIEW public.v_dashboard_decaduto AS
SELECT
  COALESCE(SUM(r.residual_at_decadence_cents), 0)::numeric / 100.0 as gross_decayed,
  COALESCE(SUM(r.transferred_amount * 100), 0)::numeric / 100.0 as transferred,
  (COALESCE(SUM(r.residual_at_decadence_cents), 0) - COALESCE(SUM(r.transferred_amount * 100), 0))::numeric / 100.0 as net_to_transfer
FROM rateations r
WHERE r.owner_uid = auth.uid()
  AND r.is_f24 = true 
  AND r.status = 'decaduta';

-- Enhanced installment payment cancellation function
CREATE OR REPLACE FUNCTION public.installment_cancel_payment(
  p_installment_id bigint,
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- Explicit recalculation call (trigger will also do this, but being explicit)
  PERFORM rateations_recalc_totals(v_rateation_id);
END;
$function$;

-- Populate existing data with calculated values
UPDATE rateations SET
  paid_amount_cents = COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = rateations.id AND i.is_paid = true
  ), 0),
  residual_amount_cents = COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = rateations.id AND i.is_paid = false
  ), 0),
  overdue_amount_cents = COALESCE((
    SELECT SUM(i.amount_cents)
    FROM installments i
    WHERE i.rateation_id = rateations.id 
    AND i.is_paid = false 
    AND i.due_date < CURRENT_DATE
  ), 0)
WHERE paid_amount_cents = 0 AND residual_amount_cents = 0 AND overdue_amount_cents = 0;