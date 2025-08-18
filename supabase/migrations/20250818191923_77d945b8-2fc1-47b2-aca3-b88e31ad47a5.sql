-- Create cancel_installment_payment function for clean ravvedimento cancellation
CREATE OR REPLACE FUNCTION public.cancel_installment_payment(p_installment_id bigint)
RETURNS public.installments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inst public.installments;
BEGIN
  -- Get installment with lock
  SELECT * INTO v_inst
  FROM public.installments
  WHERE id = p_installment_id
  FOR UPDATE;

  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;

  -- Check ownership
  IF v_inst.owner_uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Clean cancellation: reset all payment and ravvedimento fields
  UPDATE public.installments
  SET is_paid = false,
      paid_at = null,
      paid_recorded_at = null,
      late_days = null,
      penalty_rule_id = null,
      penalty_amount_cents = null,
      interest_amount_cents = null,
      paid_total_cents = null,
      interest_breakdown = null,
      updated_at = now()
  WHERE id = p_installment_id
  RETURNING * INTO v_inst;

  RETURN v_inst;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_installment_payment(bigint) TO authenticated;