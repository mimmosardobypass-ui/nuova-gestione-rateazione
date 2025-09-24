-- Fix search_path security warning for sync_is_quater function
CREATE OR REPLACE FUNCTION sync_is_quater()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;