-- Add missing late_days column to installments table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'installments' 
                   AND column_name = 'late_days' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.installments ADD COLUMN late_days INTEGER;
    END IF;
END $$;