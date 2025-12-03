-- Drop the old 4-parameter version of residual_evolution_by_type to remove ambiguity
DROP FUNCTION IF EXISTS public.residual_evolution_by_type(integer, integer, text, text);