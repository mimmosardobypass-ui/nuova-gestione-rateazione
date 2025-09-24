-- Fix orphaned RQ allocation link by correcting is_quater flag
-- RQ id=18 is type "Riam.Quater" but has is_quater=false

UPDATE rateations 
SET is_quater = true
WHERE id = 18 
  AND EXISTS (
    SELECT 1 FROM rateation_types rt 
    WHERE rt.id = rateations.type_id 
    AND UPPER(rt.name) LIKE '%QUATER%'
  );

-- Add performance indexes for RQ allocation operations
CREATE INDEX IF NOT EXISTS rql_pagopa_idx ON riam_quater_links(pagopa_id);
CREATE INDEX IF NOT EXISTS rql_rq_idx ON riam_quater_links(riam_quater_id);

-- Add constraint to prevent future inconsistencies
-- This trigger will auto-set is_quater=true for Riam.Quater types
CREATE OR REPLACE FUNCTION sync_is_quater()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the type is Riam.Quater and sync is_quater flag
  IF NEW.type_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM rateation_types 
      WHERE id = NEW.type_id 
      AND UPPER(COALESCE(name, '')) LIKE '%QUATER%'
    ) THEN
      NEW.is_quater := TRUE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_sync_is_quater ON rateations;
CREATE TRIGGER trigger_sync_is_quater
  BEFORE INSERT OR UPDATE OF type_id ON rateations
  FOR EACH ROW EXECUTE FUNCTION sync_is_quater();