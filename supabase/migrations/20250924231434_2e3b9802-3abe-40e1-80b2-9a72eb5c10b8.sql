-- Create transactional RPC for unlinking PagoPA from RQ
CREATE OR REPLACE FUNCTION public.link_pagopa_unlink(
  p_pagopa_id bigint,
  p_rq_id bigint,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(pagopa_id bigint, riam_quater_id bigint, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
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

  -- Return result even if link didn't exist (idempotent operation)
  RETURN QUERY
  SELECT p_pagopa_id, p_rq_id, 
    CASE WHEN v_found THEN 'deleted'::text ELSE 'not_found'::text END;
END;
$$;