-- Add missing columns for enhanced payment tracking
ALTER TABLE public.installments 
ADD COLUMN IF NOT EXISTS paid_recorded_at timestamptz,
ADD COLUMN IF NOT EXISTS late_days int,
ADD COLUMN IF NOT EXISTS status text;

-- Add useful indexes
CREATE INDEX IF NOT EXISTS idx_installments_rateation ON public.installments(rateation_id);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_installments_rateation_seq ON public.installments(rateation_id, seq);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_is_paid ON public.installments(is_paid);

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