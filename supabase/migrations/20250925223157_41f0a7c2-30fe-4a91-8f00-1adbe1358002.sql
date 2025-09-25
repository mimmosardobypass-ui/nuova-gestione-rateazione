-- FASE 1: Database (Robustezza e verità unica) - CORRECTED

-- 1.1 RQ selezionabili (esclude RQ già agganciate a qualunque PagoPA)
CREATE OR REPLACE FUNCTION public.get_rq_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE (
  id bigint,
  number text,
  taxpayer_name text,
  quater_total_due_cents bigint
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT r.id, r.number, r.taxpayer_name, COALESCE(r.quater_total_due_cents, 0)
  FROM rateations r
  WHERE r.is_quater = true
    AND COALESCE(r.status, '') <> 'INTERROTTA'
    AND r.owner_uid = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM riam_quater_links l
      JOIN rateations p ON p.id = l.pagopa_id
      WHERE l.riam_quater_id = r.id
        AND COALESCE(l.allocated_residual_cents, 0) > 0
        AND p.owner_uid = auth.uid()
    )
  ORDER BY NULLIF(regexp_replace(r.number, '\D', '', 'g'), '')::int NULLS LAST, r.number;
$$;

-- 1.2 Quota allocabile ufficiale (usando type_id per identificare PagoPA)
CREATE OR REPLACE FUNCTION public.pagopa_quota_info(p_pagopa_id bigint)
RETURNS TABLE (
  residual_cents bigint,
  allocated_cents bigint,
  allocatable_cents bigint
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT
    COALESCE(p.residual_amount_cents, 0) as residual_cents,
    COALESCE(SUM(l.allocated_residual_cents), 0) as allocated_cents,
    GREATEST(COALESCE(p.residual_amount_cents, 0) - COALESCE(SUM(l.allocated_residual_cents), 0), 0) as allocatable_cents
  FROM rateations p
  LEFT JOIN riam_quater_links l ON l.pagopa_id = p.id
  LEFT JOIN rateation_types rt ON rt.id = p.type_id
  WHERE p.id = p_pagopa_id
    AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
    AND p.owner_uid = auth.uid()
  GROUP BY p.id, p.residual_amount_cents;
$$;

-- 1.3 Lock/Unlock granulare e a prova di edge cases
CREATE OR REPLACE FUNCTION public.pagopa_lock_for_rq(p_pagopa_id bigint)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  UPDATE rateations
     SET status = 'INTERROTTA',
         interruption_reason = 'RQ_LINK',
         interrupted_at = CURRENT_DATE
   WHERE id = p_pagopa_id
     AND EXISTS (
       SELECT 1 FROM rateation_types rt 
       WHERE rt.id = rateations.type_id 
       AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
     )
     AND owner_uid = auth.uid()
     AND COALESCE(interruption_reason, 'RQ_LINK') IN ('RQ_LINK'); -- non sovrascrivere altri motivi
END $$;

-- Aggiorna la funzione unlock esistente per essere più robusta  
CREATE OR REPLACE FUNCTION public.pagopa_unlock_if_no_links(p_pagopa_id bigint)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE 
  _has_links boolean;
  _was_updated boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM riam_quater_links 
    WHERE pagopa_id = p_pagopa_id
  ) INTO _has_links;

  IF NOT _has_links THEN
    UPDATE rateations
       SET status = 'attiva', 
           interruption_reason = NULL,
           interrupted_at = NULL,
           updated_at = NOW()
     WHERE id = p_pagopa_id
       AND status = 'INTERROTTA'
       AND interruption_reason = 'RQ_LINK'
       AND owner_uid = auth.uid();
    
    GET DIAGNOSTICS _was_updated = ROW_COUNT;
    RETURN _was_updated > 0;
  END IF;
  
  RETURN false;
END $$;

-- 1.4 Aggiorna le RPC transazionali esistenti per usare le nuove funzioni
CREATE OR REPLACE FUNCTION public.link_pagopa_to_rq_atomic(
  p_pagopa_id bigint, 
  p_rq_id bigint, 
  p_alloc_cents bigint, 
  p_reason text DEFAULT NULL::text
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
  v_quota_info record;
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
  
  -- Verifica che sia tipo PagoPA
  IF NOT EXISTS (
    SELECT 1 FROM rateation_types rt 
    WHERE rt.id = v_pagopa_row.type_id 
    AND UPPER(COALESCE(rt.name, '')) = 'PAGOPA'
  ) THEN
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

  -- 3. Usa la nuova RPC per calcolare quota disponibile
  SELECT * INTO v_quota_info
  FROM pagopa_quota_info(p_pagopa_id)
  LIMIT 1;

  IF NOT FOUND OR COALESCE(v_quota_info.allocatable_cents, 0) < p_alloc_cents THEN
    RAISE EXCEPTION 'INSUFFICIENT_QUOTA: Available: %, requested: %', 
      COALESCE(v_quota_info.allocatable_cents, 0), p_alloc_cents;
  END IF;

  -- 4. Ottieni allocazione corrente per questa coppia
  SELECT COALESCE(allocated_residual_cents, 0)
  INTO v_current
  FROM riam_quater_links
  WHERE pagopa_id = p_pagopa_id AND riam_quater_id = p_rq_id;

  -- 5. Upsert atomico
  INSERT INTO riam_quater_links(pagopa_id, riam_quater_id, allocated_residual_cents, reason)
  VALUES (p_pagopa_id, p_rq_id, p_alloc_cents, p_reason)
  ON CONFLICT (riam_quater_id, pagopa_id)
  DO UPDATE SET 
    allocated_residual_cents = EXCLUDED.allocated_residual_cents,
    reason = COALESCE(EXCLUDED.reason, riam_quater_links.reason)
  RETURNING * INTO v_upsert;

  -- 6. Determina azione eseguita
  v_action := CASE WHEN v_current > 0 THEN 'updated' ELSE 'created' END;

  -- 7. Lock PagoPA usando la nuova funzione
  PERFORM pagopa_lock_for_rq(p_pagopa_id);

  -- 8. Return row per UI refresh
  RETURN QUERY
  SELECT 
    v_upsert.pagopa_id,
    v_upsert.riam_quater_id,
    v_upsert.allocated_residual_cents,
    v_upsert.reason,
    v_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_pagopa_unlink(
  p_pagopa_id bigint, 
  p_rq_id bigint, 
  p_reason text DEFAULT NULL::text
)
RETURNS TABLE(
  pagopa_id bigint, 
  riam_quater_id bigint, 
  action text, 
  unlocked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_found boolean := false;
  v_unlocked boolean := false;
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

  -- Usa la nuova funzione unlock
  SELECT pagopa_unlock_if_no_links(p_pagopa_id) INTO v_unlocked;
  
  RETURN QUERY
  SELECT 
    p_pagopa_id, 
    p_rq_id, 
    CASE WHEN v_found THEN 'deleted'::text ELSE 'not_found'::text END,
    v_unlocked;
END;
$$;