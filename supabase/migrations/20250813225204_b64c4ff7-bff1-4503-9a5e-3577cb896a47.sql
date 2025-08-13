-- Add missing columns for enhanced payment tracking
ALTER TABLE public.installments 
ADD COLUMN IF NOT EXISTS paid_recorded_at timestamptz;

-- Add generated columns for automatic calculations
ALTER TABLE public.installments 
ADD COLUMN IF NOT EXISTS late_days int 
GENERATED ALWAYS AS (
  CASE 
    WHEN is_paid THEN GREATEST(0, (paid_at - due_date))
    ELSE GREATEST(0, (CURRENT_DATE - due_date))
  END
) STORED;

ALTER TABLE public.installments 
ADD COLUMN IF NOT EXISTS status text 
GENERATED ALWAYS AS (
  CASE
    WHEN is_paid THEN 'paid'
    WHEN CURRENT_DATE > due_date THEN 'late'
    ELSE 'due'
  END
) STORED;

-- Add useful indexes
CREATE INDEX IF NOT EXISTS idx_installments_rateation ON public.installments(rateation_id);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_installments_rateation_seq ON public.installments(rateation_id, seq);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_is_paid ON public.installments(is_paid);

-- Update existing RPC function to support audit trail
CREATE OR REPLACE FUNCTION public.fn_set_installment_paid(
  p_rateation_id bigint, 
  p_seq integer, 
  p_paid boolean, 
  p_paid_at date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE installments
  SET is_paid = p_paid,
      paid_at = CASE WHEN p_paid THEN COALESCE(p_paid_at, CURRENT_DATE) ELSE NULL END,
      paid_recorded_at = CASE WHEN p_paid THEN NOW() ELSE NULL END
  WHERE owner_uid = auth.uid()
    AND rateation_id = p_rateation_id
    AND seq = p_seq;
END;
$$;

-- New RPC function specifically for marking as paid with custom date
CREATE OR REPLACE FUNCTION public.mark_installment_paid(
  p_rateation_id bigint,
  p_seq integer,
  p_paid_at date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE installments
  SET is_paid = true,
      paid_at = p_paid_at,
      paid_recorded_at = NOW()
  WHERE owner_uid = auth.uid()
    AND rateation_id = p_rateation_id
    AND seq = p_seq;
END;
$$;

-- New RPC function to unmark as paid
CREATE OR REPLACE FUNCTION public.unmark_installment_paid(
  p_rateation_id bigint,
  p_seq integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE installments
  SET is_paid = false,
      paid_at = NULL,
      paid_recorded_at = NULL
  WHERE owner_uid = auth.uid()
    AND rateation_id = p_rateation_id
    AND seq = p_seq;
END;
$$;