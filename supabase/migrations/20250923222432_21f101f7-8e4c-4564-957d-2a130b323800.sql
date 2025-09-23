-- Add Rottamazione Quater fields to rateations table
ALTER TABLE public.rateations 
ADD COLUMN IF NOT EXISTS is_quater BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_total_due_cents BIGINT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quater_total_due_cents BIGINT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.rateations.is_quater IS 'True if this is a Rottamazione Quater rateation';
COMMENT ON COLUMN public.rateations.original_total_due_cents IS 'Original debt amount before Quater reduction (in cents)';
COMMENT ON COLUMN public.rateations.quater_total_due_cents IS 'Reduced amount with Quater reduction (in cents)';

-- Add index for efficient filtering of Quater rateations
CREATE INDEX IF NOT EXISTS idx_rateations_is_quater ON public.rateations(is_quater) WHERE is_quater = TRUE;