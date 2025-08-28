-- PREVENTION SYSTEM: Block unauthorized RQ creation

-- Create app schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Helper function to get RQ type ID
CREATE OR REPLACE FUNCTION app.get_rq_type_id()
RETURNS bigint 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT id FROM public.rateation_types WHERE name = 'RQ' LIMIT 1
$$;

-- Trigger function to block unauthorized RQ creation
CREATE OR REPLACE FUNCTION app.block_unauthorized_rq_creation()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  rq_id bigint := app.get_rq_type_id();
  allow_flag text := current_setting('app.allow_rq_creation', true);
BEGIN
  -- Block RQ creation unless explicitly authorized
  IF NEW.type_id = rq_id AND COALESCE(allow_flag, 'off') <> 'on' THEN
    RAISE EXCEPTION 'Creation of RQ plans is disabled (missing app.allow_rq_creation=on)';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Install the trigger
DROP TRIGGER IF EXISTS trg_block_unauthorized_rq_creation ON public.rateations;
CREATE TRIGGER trg_block_unauthorized_rq_creation
  BEFORE INSERT ON public.rateations
  FOR EACH ROW 
  EXECUTE FUNCTION app.block_unauthorized_rq_creation();