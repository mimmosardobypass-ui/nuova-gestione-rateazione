-- Force complete PostgREST schema reload and clear any caches
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Verify functions are using correct patterns
DO $$
DECLARE
  func_def text;
BEGIN
  -- Check get_filtered_stats
  SELECT pg_get_functiondef(oid) INTO func_def
  FROM pg_proc
  WHERE proname = 'get_filtered_stats' AND pronamespace = 'public'::regnamespace;
  
  IF func_def NOT LIKE '%type_norm = ANY(%' THEN
    RAISE EXCEPTION 'get_filtered_stats does not use ANY pattern';
  END IF;
  
  -- Check stats_per_tipologia_effective  
  SELECT pg_get_functiondef(oid) INTO func_def
  FROM pg_proc
  WHERE proname = 'stats_per_tipologia_effective' AND pronamespace = 'public'::regnamespace;
  
  IF func_def NOT LIKE '%type_norm = ANY(%' THEN
    RAISE EXCEPTION 'stats_per_tipologia_effective does not use ANY pattern';
  END IF;
  
  -- Check get_residual_detail
  SELECT pg_get_functiondef(oid) INTO func_def
  FROM pg_proc
  WHERE proname = 'get_residual_detail' AND pronamespace = 'public'::regnamespace;
  
  IF func_def NOT LIKE '%type_norm = ANY(%' THEN
    RAISE EXCEPTION 'get_residual_detail does not use ANY pattern';
  END IF;
  
  RAISE NOTICE 'All functions verified: using correct ANY pattern';
END $$;