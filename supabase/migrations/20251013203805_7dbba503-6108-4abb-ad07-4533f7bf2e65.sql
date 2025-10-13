-- Fix permissions for stats_v2 RPC
-- Grant execute to all authenticated users and service role
GRANT EXECUTE ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) TO anon;

-- Also grant usage on the schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;