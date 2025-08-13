-- 1. Make owner_uid nullable to allow global types
ALTER TABLE public.rateation_types ALTER COLUMN owner_uid DROP NOT NULL;

-- 2. Create unique constraint on name to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS rateation_types_name_key ON public.rateation_types (name);

-- 3. Create trigger function for automatic owner_uid assignment
CREATE OR REPLACE FUNCTION set_owner_uid_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_uid IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.owner_uid := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger to automatically set owner_uid on insert (only for authenticated users)
DROP TRIGGER IF EXISTS trigger_set_owner_uid_rateation_types ON public.rateation_types;
CREATE TRIGGER trigger_set_owner_uid_rateation_types
  BEFORE INSERT ON public.rateation_types
  FOR EACH ROW
  EXECUTE FUNCTION set_owner_uid_default();

-- 5. Drop ALL existing policies
DROP POLICY IF EXISTS "rateation_types_owner_write" ON public.rateation_types;
DROP POLICY IF EXISTS "rateation_types_read_authenticated" ON public.rateation_types;
DROP POLICY IF EXISTS "types_select_all" ON public.rateation_types;
DROP POLICY IF EXISTS "types_insert_own" ON public.rateation_types;

-- 6. Create new policies with unique names
CREATE POLICY "rls_types_select_authenticated" ON public.rateation_types
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rls_types_insert_user" ON public.rateation_types  
  FOR INSERT TO authenticated
  WITH CHECK (owner_uid IS NULL OR owner_uid = auth.uid());

-- 7. Re-seed base types as global (owner_uid NULL)
INSERT INTO public.rateation_types (name, owner_uid)
VALUES 
  ('F24', NULL),
  ('PagoPA', NULL), 
  ('Quater', NULL)
ON CONFLICT (name) DO NOTHING;