-- Fix security warnings for functions created in the previous migration
-- Add proper search_path settings to prevent SQL injection

-- Fix recompute_rateation_caches function
CREATE OR REPLACE FUNCTION public.recompute_rateation_caches(p_rateation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Fix rateations_recalc_totals function
CREATE OR REPLACE FUNCTION public.rateations_recalc_totals(p_rateation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Fix trg_recalc_totals_installments function
CREATE OR REPLACE FUNCTION public.trg_recalc_totals_installments()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rateation_id bigint;
BEGIN
  v_rateation_id := COALESCE(NEW.rateation_id, OLD.rateation_id);
  PERFORM rateations_recalc_totals(v_rateation_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix rateation_confirm_decadence function
CREATE OR REPLACE FUNCTION public.rateation_confirm_decadence(
  p_rateation_id bigint, 
  p_installment_id bigint DEFAULT NULL, 
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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