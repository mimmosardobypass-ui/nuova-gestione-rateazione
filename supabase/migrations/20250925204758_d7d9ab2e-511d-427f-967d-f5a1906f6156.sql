-- DROP della funzione esistente e ricreazione con nuovo return type
DROP FUNCTION IF EXISTS public.link_pagopa_unlink(bigint, bigint, text);

-- Ricrea la funzione con auto-unlock
CREATE OR REPLACE FUNCTION public.link_pagopa_unlink(
  p_pagopa_id bigint,
  p_rq_id bigint,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(pagopa_id bigint, riam_quater_id bigint, action text, unlocked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining int;
  v_was_interrupted boolean;
  v_found boolean := false;
BEGIN
  -- Explicit ownership check for both rateations
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'PAGOPA_ACCESS_DENIED: PagoPA not found or access denied';
  END IF;
  
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_rq_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'RQ_ACCESS_DENIED: RQ not found or access denied';
  END IF;

  -- Lock the specific link (if it exists)
  SELECT EXISTS (
    SELECT 1 FROM riam_quater_links
    WHERE pagopa_id = p_pagopa_id AND riam_quater_id = p_rq_id
    FOR UPDATE
  ) INTO v_found;

  -- Delete the link
  DELETE FROM riam_quater_links
  WHERE pagopa_id = p_pagopa_id AND riam_quater_id = p_rq_id;

  -- Check current status and count remaining links (lock row for consistency)
  SELECT status = 'INTERROTTA'
  INTO v_was_interrupted
  FROM rateations
  WHERE id = p_pagopa_id
  FOR UPDATE;

  SELECT count(*)
  INTO v_remaining
  FROM riam_quater_links
  WHERE pagopa_id = p_pagopa_id;

  -- If was interrupted and no links remain, unlock it
  IF v_was_interrupted AND v_remaining = 0 THEN
    UPDATE rateations
    SET status = 'attiva',
        interruption_reason = NULL,
        interrupted_at = NULL,
        updated_at = NOW()
    WHERE id = p_pagopa_id;
    
    RETURN QUERY
    SELECT p_pagopa_id, p_rq_id, 
      CASE WHEN v_found THEN 'deleted'::text ELSE 'not_found'::text END,
      true::boolean;
  ELSE
    RETURN QUERY
    SELECT p_pagopa_id, p_rq_id, 
      CASE WHEN v_found THEN 'deleted'::text ELSE 'not_found'::text END,
      false::boolean;
  END IF;
END;
$function$;

-- Funzione per sbloccare PagoPA senza link (casi legacy)
CREATE OR REPLACE FUNCTION public.pagopa_unlock_if_no_links(p_pagopa_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH link_count AS (
    SELECT count(*)::int AS n 
    FROM riam_quater_links 
    WHERE pagopa_id = p_pagopa_id
  )
  UPDATE rateations r
  SET status = 'attiva', 
      interruption_reason = NULL, 
      interrupted_at = NULL, 
      updated_at = NOW()
  FROM link_count
  WHERE r.id = p_pagopa_id 
    AND link_count.n = 0 
    AND r.status = 'INTERROTTA'
    AND r.owner_uid = auth.uid()
  RETURNING true;
$function$;