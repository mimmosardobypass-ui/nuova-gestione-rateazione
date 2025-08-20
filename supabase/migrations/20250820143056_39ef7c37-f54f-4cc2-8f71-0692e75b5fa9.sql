-- F24 Management Enhancement Migration
-- 1. Backfill is_f24 for existing F24 plans
UPDATE rateations 
SET is_f24 = TRUE 
WHERE is_f24 IS DISTINCT FROM TRUE 
  AND EXISTS (
    SELECT 1 FROM rateation_types rt 
    WHERE rt.id = rateations.type_id 
    AND UPPER(COALESCE(rt.name, '')) = 'F24'
  );

-- 2. Create sync trigger to automatically set is_f24 based on type
CREATE OR REPLACE FUNCTION sync_is_f24()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Check if the type is F24 and sync is_f24 flag
  IF NEW.type_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM rateation_types 
      WHERE id = NEW.type_id 
      AND UPPER(COALESCE(name, '')) = 'F24'
    ) THEN
      NEW.is_f24 := TRUE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_f24 ON rateations;
CREATE TRIGGER trg_sync_is_f24
  BEFORE INSERT OR UPDATE OF type_id ON rateations
  FOR EACH ROW 
  EXECUTE FUNCTION sync_is_f24();

-- 3. Add index for better performance on F24 queries
CREATE INDEX IF NOT EXISTS idx_rateations_is_f24 ON rateations(is_f24) WHERE is_f24 = TRUE;
CREATE INDEX IF NOT EXISTS idx_rateations_status_f24 ON rateations(status, is_f24) WHERE is_f24 = TRUE;