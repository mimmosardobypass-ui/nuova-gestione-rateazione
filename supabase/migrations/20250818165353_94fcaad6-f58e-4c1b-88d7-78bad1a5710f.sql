-- Add amount_cents column to installments table
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS amount_cents BIGINT;

-- Update existing records to have amount_cents = amount * 100
UPDATE public.installments 
SET amount_cents = (amount * 100)::bigint 
WHERE amount_cents IS NULL;

-- Create trigger function to sync amount and amount_cents
CREATE OR REPLACE FUNCTION public.sync_amount_cents()
RETURNS TRIGGER AS $$
BEGIN
  -- If amount is updated, sync amount_cents
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    NEW.amount_cents := (NEW.amount * 100)::bigint;
  END IF;
  
  -- If amount_cents is updated, sync amount
  IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents THEN
    NEW.amount := NEW.amount_cents::numeric / 100;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for amount sync
DROP TRIGGER IF EXISTS sync_amount_cents_trigger ON public.installments;
CREATE TRIGGER sync_amount_cents_trigger
  BEFORE UPDATE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_amount_cents();

-- Create manual ravvedimento function
CREATE OR REPLACE FUNCTION public.apply_ravvedimento_manual(
  p_installment_id      bigint,
  p_paid_at             date,
  p_paid_total_cents    bigint,
  p_profile_id          uuid DEFAULT NULL
)
RETURNS public.installments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inst     public.installments;
  v_calc     jsonb;
  v_penalty  bigint := 0;
  v_interest bigint := 0;
BEGIN
  -- Get installment with security check
  SELECT * INTO v_inst
  FROM public.installments
  WHERE id = p_installment_id
    AND owner_uid = auth.uid()
  FOR UPDATE;

  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Installment not found or access denied';
  END IF;

  -- Calculate suggested amounts using existing function
  v_calc := public.compute_ravvedimento(
    v_inst.amount_cents, 
    v_inst.due_date, 
    p_paid_at, 
    p_profile_id
  );

  -- Use suggested penalty, calculate interest as remainder
  v_penalty := COALESCE((v_calc->>'penalty_amount_cents')::bigint, 0);
  v_interest := GREATEST(p_paid_total_cents - v_inst.amount_cents - v_penalty, 0);

  -- Update installment with manual values
  UPDATE public.installments
  SET is_paid = true,
      paid_at = p_paid_at,
      paid_recorded_at = NOW(),
      late_days = GREATEST(p_paid_at - v_inst.due_date, 0),
      penalty_rule_id = NULLIF(v_calc->>'penalty_rule_id', '')::uuid,
      penalty_amount_cents = v_penalty,
      interest_amount_cents = v_interest,
      paid_total_cents = p_paid_total_cents,
      interest_breakdown = v_calc->'interest_breakdown'
  WHERE id = p_installment_id
  RETURNING * INTO v_inst;

  RETURN v_inst;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.apply_ravvedimento_manual(bigint, date, bigint, uuid) TO authenticated;