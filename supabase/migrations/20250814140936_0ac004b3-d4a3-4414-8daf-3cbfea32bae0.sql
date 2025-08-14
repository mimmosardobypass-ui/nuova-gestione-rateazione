-- Enable Realtime for rateations and installments tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rateations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;

-- Add updated_at trigger for better change tracking
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column to rateations if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rateations' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.rateations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Create trigger for rateations updated_at
DROP TRIGGER IF EXISTS update_rateations_updated_at ON public.rateations;
CREATE TRIGGER update_rateations_updated_at
  BEFORE UPDATE ON public.rateations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create performance index for rateations queries
CREATE INDEX IF NOT EXISTS idx_rateations_owner_uid_created 
ON public.rateations (owner_uid, created_at DESC);

-- Ensure all existing rateations have owner_uid set (backfill)
UPDATE public.rateations 
SET owner_uid = (
  SELECT auth.uid() 
  FROM auth.users 
  LIMIT 1
)
WHERE owner_uid IS NULL;

-- Add helpful function for debugging
CREATE OR REPLACE FUNCTION public.debug_rateations_count()
RETURNS TABLE(user_id uuid, rateations_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT owner_uid, COUNT(*)
  FROM public.rateations
  WHERE owner_uid IS NOT NULL
  GROUP BY owner_uid;
$$;