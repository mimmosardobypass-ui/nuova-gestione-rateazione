-- Fix ambiguous column error and optimize link_f24_to_pagopa_atomic
-- 1. Qualify all column references explicitly
-- 2. Use pre-calculated fields instead of JOIN aggregations for performance
-- 3. Align with preview_link_f24_to_pagopa logic

CREATE OR REPLACE FUNCTION public.link_f24_to_pagopa_atomic(
  p_f24_id BIGINT, 
  p_pagopa_id BIGINT, 
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  link_id UUID, 
  f24_id BIGINT, 
  pagopa_id BIGINT, 
  maggiorazione_cents BIGINT, 
  action TEXT
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_f24_residual_cents BIGINT;
  v_pagopa_total_cents BIGINT;
  v_maggiorazione_cents BIGINT;
  v_f24_taxpayer TEXT;
  v_pagopa_taxpayer TEXT;
  v_link_id UUID;
  v_existing_link_id UUID;
  v_action TEXT;
BEGIN
  -- Security checks
  IF NOT EXISTS (
    SELECT 1 FROM public.rateations 
    WHERE id = p_f24_id 
      AND owner_uid = auth.uid() 
      AND is_f24 = TRUE
  ) THEN
    RAISE EXCEPTION 'F24_ACCESS_DENIED: F24 not found or access denied';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.rateations r 
    WHERE r.id = p_pagopa_id 
      AND r.owner_uid = auth.uid() 
      AND EXISTS (
        SELECT 1 FROM public.rateation_types rt 
        WHERE rt.id = r.type_id 
          AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
      )
  ) THEN
    RAISE EXCEPTION 'PAGOPA_ACCESS_DENIED: PagoPA not found or access denied';
  END IF;
  
  -- Get F24 residual using snapshot field (consistent with preview)
  SELECT 
    COALESCE(r.residual_at_decadence_cents, r.residual_amount_cents, 0), 
    r.taxpayer_name 
  INTO v_f24_residual_cents, v_f24_taxpayer
  FROM public.rateations r
  WHERE r.id = p_f24_id;
  
  -- Get PagoPA total using total_amount (consistent with preview)
  SELECT 
    COALESCE((r.total_amount * 100)::bigint, 0), 
    r.taxpayer_name 
  INTO v_pagopa_total_cents, v_pagopa_taxpayer
  FROM public.rateations r
  WHERE r.id = p_pagopa_id;
  
  -- Calculate maggiorazione
  v_maggiorazione_cents := GREATEST(0, v_pagopa_total_cents - v_f24_residual_cents);
  
  -- Check existing link (FIX: qualify columns explicitly to avoid ambiguity)
  SELECT f24_pagopa_links.id 
  INTO v_existing_link_id 
  FROM public.f24_pagopa_links 
  WHERE f24_pagopa_links.f24_id = p_f24_id;
  
  -- Upsert link
  IF v_existing_link_id IS NOT NULL THEN
    UPDATE public.f24_pagopa_links 
    SET pagopa_id = p_pagopa_id,
        snapshot_f24_residual_cents = v_f24_residual_cents,
        snapshot_f24_taxpayer = v_f24_taxpayer,
        pagopa_total_cents = v_pagopa_total_cents,
        pagopa_taxpayer = v_pagopa_taxpayer,
        maggiorazione_allocata_cents = v_maggiorazione_cents,
        reason = COALESCE(p_reason, reason),
        linked_at = NOW()
    WHERE id = v_existing_link_id 
    RETURNING id INTO v_link_id;
    
    v_action := 'updated';
  ELSE
    INSERT INTO public.f24_pagopa_links (
      f24_id,
      pagopa_id,
      snapshot_f24_residual_cents,
      snapshot_f24_taxpayer,
      pagopa_total_cents,
      pagopa_taxpayer,
      maggiorazione_allocata_cents,
      reason
    )
    VALUES (
      p_f24_id,
      p_pagopa_id,
      v_f24_residual_cents,
      v_f24_taxpayer,
      v_pagopa_total_cents,
      v_pagopa_taxpayer,
      v_maggiorazione_cents,
      p_reason
    )
    RETURNING id INTO v_link_id;
    
    v_action := 'created';
  END IF;
  
  -- Mark F24 as interrupted
  UPDATE public.rateations 
  SET status = 'INTERROTTA',
      interruption_reason = 'F24_PAGOPA_LINK',
      interrupted_at = COALESCE(interrupted_at, NOW())
  WHERE id = p_f24_id 
    AND status != 'INTERROTTA';
  
  -- Return result
  RETURN QUERY 
  SELECT v_link_id, p_f24_id, p_pagopa_id, v_maggiorazione_cents, v_action;
END;
$$;