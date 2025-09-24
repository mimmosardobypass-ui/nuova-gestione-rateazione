-- Fix search_path security warning per la nuova funzione
CREATE OR REPLACE FUNCTION link_pagopa_to_rq_atomic(
  p_pagopa_id bigint,
  p_rq_id bigint,
  p_alloc_cents bigint,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(
  pagopa_id bigint,
  riam_quater_id bigint,
  allocated_residual_cents bigint,
  reason text,
  action text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_upsert riam_quater_links;
  v_allocatable numeric;
  v_current bigint := 0;
  v_action text;
  v_pagopa_row rateations;
  v_rq_row rateations;
BEGIN
  -- 1. Validazione input
  IF p_alloc_cents IS NULL OR p_alloc_cents <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUOTA: Allocated quota must be > 0';
  END IF;

  -- 2. Verifica ownership e tipi con lock atomico
  SELECT * INTO v_pagopa_row 
  FROM rateations 
  WHERE id = p_pagopa_id 
    AND owner_uid = auth.uid() 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAGOPA_ACCESS_DENIED: PagoPA not found or access denied';
  END IF;
  
  IF NOT COALESCE(v_pagopa_row.is_pagopa, false) THEN
    RAISE EXCEPTION 'INVALID_PAGOPA_TYPE: Rateation must be PagoPA type';
  END IF;

  SELECT * INTO v_rq_row 
  FROM rateations 
  WHERE id = p_rq_id 
    AND owner_uid = auth.uid() 
  FOR UPDATE;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RQ_ACCESS_DENIED: RQ not found or access denied';
  END IF;
  
  IF NOT COALESCE(v_rq_row.is_quater, false) THEN
    RAISE EXCEPTION 'INVALID_RQ_TYPE: Target rateation must be Riammissione Quater type';
  END IF;

  -- 3. Calcola quota disponibile considerando allocazione esistente
  SELECT COALESCE(allocated_residual_cents, 0)
  INTO v_current
  FROM riam_quater_links
  WHERE pagopa_id = p_pagopa_id AND riam_quater_id = p_rq_id;

  SELECT COALESCE(allocatable_cents, 0)
  INTO v_allocatable
  FROM v_pagopa_allocations
  WHERE pagopa_id = p_pagopa_id;

  -- Verifica quota sufficiente (quota disponibile + quota già allocata a questa coppia)
  IF COALESCE(v_allocatable, 0) + COALESCE(v_current, 0) < p_alloc_cents THEN
    RAISE EXCEPTION 'INSUFFICIENT_QUOTA: Available: %, requested: %', 
      (COALESCE(v_allocatable, 0) + COALESCE(v_current, 0)), p_alloc_cents;
  END IF;

  -- 4. Upsert atomico
  INSERT INTO riam_quater_links(pagopa_id, riam_quater_id, allocated_residual_cents, reason)
  VALUES (p_pagopa_id, p_rq_id, p_alloc_cents, p_reason)
  ON CONFLICT (riam_quater_id, pagopa_id)
  DO UPDATE SET 
    allocated_residual_cents = EXCLUDED.allocated_residual_cents,
    reason = COALESCE(EXCLUDED.reason, riam_quater_links.reason)
  RETURNING * INTO v_upsert;

  -- 5. Determina azione eseguita
  v_action := CASE WHEN v_current > 0 THEN 'updated' ELSE 'created' END;

  -- 6. Return row per UI refresh
  RETURN QUERY
  SELECT 
    v_upsert.pagopa_id,
    v_upsert.riam_quater_id,
    v_upsert.allocated_residual_cents,
    v_upsert.reason,
    v_action;
END;
$$;