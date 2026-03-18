-- 1. Trigger function to auto-sync is_quinquies
CREATE OR REPLACE FUNCTION public.sync_is_quinquies()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM rateation_types
      WHERE id = NEW.type_id
      AND UPPER(COALESCE(name, '')) LIKE '%QUINQUIES%'
    ) THEN
      NEW.is_quinquies := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger
CREATE TRIGGER trigger_sync_is_quinquies
  BEFORE INSERT OR UPDATE ON rateations
  FOR EACH ROW EXECUTE FUNCTION sync_is_quinquies();

-- 3. Backfill existing R5 rateations
UPDATE rateations
SET is_quinquies = true
WHERE type_id IN (
  SELECT id FROM rateation_types
  WHERE UPPER(COALESCE(name, '')) LIKE '%QUINQUIES%'
)
AND (is_quinquies IS NULL OR is_quinquies = false);