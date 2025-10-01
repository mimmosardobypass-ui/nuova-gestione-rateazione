-- Remove obsolete allocation validation trigger and function
-- These were part of the old quota-based allocation system

-- Drop the trigger first
DROP TRIGGER IF EXISTS validate_pagopa_allocation_insupd ON riam_quater_links;

-- Drop the function
DROP FUNCTION IF EXISTS public.trg_validate_pagopa_allocation();

-- Verify riam_quater_links table is clean
COMMENT ON TABLE riam_quater_links IS 'Links between PagoPA and RQ rateations - no quota validation, simple association';
