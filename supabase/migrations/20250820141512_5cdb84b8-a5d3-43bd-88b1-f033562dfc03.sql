-- Enhanced RLS security for decadence RPC functions
-- Add ownership checks to existing functions

-- Update rateation_confirm_decadence with explicit ownership check
CREATE OR REPLACE FUNCTION public.rateation_confirm_decadence(
  p_rateation_id bigint, 
  p_installment_id bigint, 
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_residual numeric(14,2);
BEGIN
  -- Explicit ownership check
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_rateation_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Idempotency check
  IF (SELECT status FROM rateations WHERE id = p_rateation_id) = 'decaduta' THEN
    RETURN;
  END IF;

  -- Calculate residual from unpaid installments (principal amount)
  SELECT COALESCE(SUM(i.amount), 0)::numeric(14,2)
  INTO v_residual
  FROM installments i
  WHERE i.rateation_id = p_rateation_id
    AND i.paid_date IS NULL
    AND i.paid_at IS NULL
    AND NOT i.is_paid;

  UPDATE rateations
  SET status = 'decaduta',
      decadence_at = NOW(),
      decadence_installment_id = p_installment_id,
      decadence_reason = p_reason,
      decadence_confirmed_by = auth.uid(),
      residual_at_decadence = v_residual
  WHERE id = p_rateation_id;
END;
$function$;

-- Update rateation_link_transfer with proper ownership check
CREATE OR REPLACE FUNCTION public.rateation_link_transfer(
  p_f24_id bigint, 
  p_pagopa_id bigint, 
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_left numeric(14,2);
BEGIN
  -- Check ownership of both rateations
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_f24_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied to F24 rateation';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied to PagoPA rateation';
  END IF;

  -- Check available amount to transfer
  SELECT (residual_at_decadence - transferred_amount)
  INTO v_left
  FROM rateations
  WHERE id = p_f24_id;

  IF p_amount <= 0 OR p_amount > v_left THEN
    RAISE EXCEPTION 'Invalid transfer amount. Available: %', v_left;
  END IF;

  -- Update F24 with transfer information
  UPDATE rateations
  SET transferred_amount = transferred_amount + p_amount,
      replaced_by_rateation_id = p_pagopa_id
  WHERE id = p_f24_id;
END;
$function$;