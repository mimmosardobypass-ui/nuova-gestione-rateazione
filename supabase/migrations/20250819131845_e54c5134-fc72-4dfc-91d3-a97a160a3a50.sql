-- Add payment mode and ravvedimento flag to installments table
ALTER TABLE public.installments 
ADD COLUMN payment_mode text 
  CHECK (payment_mode IN ('ordinary', 'ravvedimento', 'partial')) 
  DEFAULT 'ordinary',
ADD COLUMN apply_ravvedimento boolean DEFAULT false;

-- Update existing paid installments that have penalties/interest to ravvedimento mode
UPDATE public.installments 
SET payment_mode = 'ravvedimento',
    apply_ravvedimento = true
WHERE is_paid = true 
  AND (penalty_amount_cents > 0 OR interest_amount_cents > 0);

-- Create function for ordinary payment (no ravvedimento calculation)
CREATE OR REPLACE FUNCTION public.mark_installment_paid_ordinary(
  p_rateation_id bigint, 
  p_seq integer, 
  p_paid_at date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_due_date date;
  v_late_days integer := 0;
BEGIN
  -- Get due date and check ownership
  SELECT due_date INTO v_due_date
  FROM public.installments
  WHERE rateation_id = p_rateation_id AND seq = p_seq
    AND owner_uid = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or access denied';
  END IF;

  -- Calculate late days (for display only, no penalties)
  IF p_paid_at > v_due_date THEN
    v_late_days := (p_paid_at - v_due_date);
  END IF;

  -- Update with ordinary payment (zero penalties/interest)
  UPDATE public.installments
  SET is_paid = true,
      paid_at = p_paid_at,
      paid_recorded_at = NOW(),
      late_days = v_late_days,
      payment_mode = 'ordinary',
      apply_ravvedimento = false,
      penalty_amount_cents = 0,
      interest_amount_cents = 0,
      paid_total_cents = (amount * 100)::bigint,
      penalty_rule_id = NULL,
      interest_breakdown = NULL
  WHERE rateation_id = p_rateation_id AND seq = p_seq
    AND owner_uid = auth.uid();
END $function$;