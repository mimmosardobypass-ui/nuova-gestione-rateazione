-- 1) Add index for better performance on owner_uid queries
CREATE INDEX IF NOT EXISTS idx_rateations_owner_uid ON rateations(owner_uid);

-- 2) Create trigger function to auto-assign owner_uid on insert
CREATE OR REPLACE FUNCTION public.fn_set_owner_uid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.owner_uid IS NULL THEN
    NEW.owner_uid := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Create trigger for rateations table
DROP TRIGGER IF EXISTS trg_set_owner_uid ON rateations;
CREATE TRIGGER trg_set_owner_uid
  BEFORE INSERT ON rateations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_owner_uid();

-- 4) Refine RLS policies for rateations (separate operations)
DROP POLICY IF EXISTS "rateations_owner_rw" ON rateations;

CREATE POLICY "rateations_select"
  ON rateations FOR SELECT
  USING (owner_uid = auth.uid());

CREATE POLICY "rateations_insert"
  ON rateations FOR INSERT
  WITH CHECK (owner_uid = auth.uid());

CREATE POLICY "rateations_update"
  ON rateations FOR UPDATE
  USING (owner_uid = auth.uid());

CREATE POLICY "rateations_delete"
  ON rateations FOR DELETE
  USING (owner_uid = auth.uid());

-- 5) Improve installments RLS policy to use join
DROP POLICY IF EXISTS "installments_owner_rw" ON installments;

CREATE POLICY "installments_select"
  ON installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rateations r
      WHERE r.id = installments.rateation_id
        AND r.owner_uid = auth.uid()
    )
  );

CREATE POLICY "installments_insert"
  ON installments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rateations r
      WHERE r.id = installments.rateation_id
        AND r.owner_uid = auth.uid()
    )
  );

CREATE POLICY "installments_update"
  ON installments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rateations r
      WHERE r.id = installments.rateation_id
        AND r.owner_uid = auth.uid()
    )
  );

CREATE POLICY "installments_delete"
  ON installments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rateations r
      WHERE r.id = installments.rateation_id
        AND r.owner_uid = auth.uid()
    )
  );