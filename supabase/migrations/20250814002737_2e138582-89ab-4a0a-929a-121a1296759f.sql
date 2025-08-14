-- 1) Add late_days column if missing
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS late_days integer;

-- 2) Create/update RPC: mark installment paid with date and calculate delay
CREATE OR REPLACE FUNCTION public.mark_installment_paid(
  p_rateation_id bigint,
  p_seq integer,
  p_paid_at date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_due_date date;
BEGIN
  -- Get due date
  SELECT due_date INTO v_due_date
  FROM public.installments
  WHERE rateation_id = p_rateation_id AND seq = p_seq
    AND owner_uid = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or access denied';
  END IF;

  -- Update with calculated late days
  UPDATE public.installments
  SET is_paid = true,
      paid_at = p_paid_at,
      paid_recorded_at = NOW(),
      late_days = GREATEST(0, (p_paid_at - v_due_date))
  WHERE rateation_id = p_rateation_id AND seq = p_seq
    AND owner_uid = auth.uid();
END $$;

-- 3) Create/update RPC: unmark installment paid
CREATE OR REPLACE FUNCTION public.unmark_installment_paid(
  p_rateation_id bigint,
  p_seq integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.installments
  SET is_paid = false,
      paid_at = NULL,
      paid_recorded_at = NULL,
      late_days = NULL
  WHERE rateation_id = p_rateation_id AND seq = p_seq
    AND owner_uid = auth.uid();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found or access denied';
  END IF;
END $$;