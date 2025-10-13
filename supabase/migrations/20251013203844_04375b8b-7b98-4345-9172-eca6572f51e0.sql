-- Grant execute to read-only user for testing
GRANT EXECUTE ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) TO supabase_read_only_user;

-- Also ensure anon can use it
GRANT EXECUTE ON FUNCTION public.stats_v2(date, date, text, boolean, uuid, text[], text[]) TO postgres;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';