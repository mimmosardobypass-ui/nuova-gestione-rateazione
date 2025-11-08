-- Drop old function signature (3 params) to resolve ambiguity
-- The new version with 4 params (including p_group_by) will remain
DROP FUNCTION IF EXISTS public.residual_evolution_by_type(integer, integer, text);