-- Final RQ Allocation Patch: Proper interruption reason handling and safety triggers

-- A) LINK: marca l'interruzione SOLO se dovuta al link RQ
CREATE OR REPLACE FUNCTION link_pagopa_to_rq_atomic(
  p_pagopa_id    bigint,
  p_rq_id        bigint,
  p_alloc_cents  bigint,
  p_reason       text default null
)
RETURNS TABLE (pagopa_id bigint, riam_quater_id bigint, allocated_residual_cents bigint, reason text, action text)
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

  -- 6. Marca lo stato SOLO per motivo 'RQ_LINK' (non tocca altri motivi)
  UPDATE rateations r
     SET status = 'INTERROTTA',
         interruption_reason = 'RQ_LINK',
         interrupted_at = CURRENT_DATE
   WHERE r.id = p_pagopa_id
     AND r.is_pagopa
     AND COALESCE(r.interruption_reason, 'RQ_LINK') IN ('RQ_LINK');

  -- 7. Return row per UI refresh
  RETURN QUERY
  SELECT 
    v_upsert.pagopa_id,
    v_upsert.riam_quater_id,
    v_upsert.allocated_residual_cents,
    v_upsert.reason,
    v_action;
END;
$$;

-- B) UNLINK: sblocca solo se motivo = 'RQ_LINK' e se era l'ultimo link
CREATE OR REPLACE FUNCTION link_pagopa_unlink(
  p_pagopa_id bigint,
  p_rq_id     bigint,
  p_reason    text default null
)
RETURNS TABLE (pagopa_id bigint, riam_quater_id bigint, action text, unlocked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SELECT status = 'INTERROTTA' AND interruption_reason = 'RQ_LINK'
  INTO v_was_interrupted
  FROM rateations
  WHERE id = p_pagopa_id
  FOR UPDATE;

  SELECT count(*)
  INTO v_remaining
  FROM riam_quater_links
  WHERE pagopa_id = p_pagopa_id;

  -- If was interrupted for RQ_LINK and no links remain, unlock it
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
$$;

-- C) Trigger di backup: se qualcuno cancella link "a mano", ripristina lo stato
CREATE OR REPLACE FUNCTION trg_unlock_pagopa_after_unlink()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM riam_quater_links WHERE pagopa_id = OLD.pagopa_id) THEN
    UPDATE rateations r
       SET status = 'attiva',
           interruption_reason = NULL,
           interrupted_at = NULL,
           updated_at = NOW()
     WHERE r.id = OLD.pagopa_id
       AND COALESCE(r.is_pagopa, false) = true
       AND r.status = 'INTERROTTA'
       AND r.interruption_reason = 'RQ_LINK';
  END IF;
  RETURN NULL;
END;
$$;

-- Drop and recreate trigger to ensure clean state
DROP TRIGGER IF EXISTS unlock_pagopa_after_unlink ON riam_quater_links;
CREATE TRIGGER unlock_pagopa_after_unlink
AFTER DELETE ON riam_quater_links
FOR EACH ROW EXECUTE FUNCTION trg_unlock_pagopa_after_unlink();

-- Add interruption_reason column if not exists
ALTER TABLE rateations 
ADD COLUMN IF NOT EXISTS interruption_reason text;

-- Indici (se non già presenti)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rq_links ON riam_quater_links(riam_quater_id, pagopa_id);
CREATE INDEX IF NOT EXISTS idx_links_pagopa ON riam_quater_links(pagopa_id);
CREATE INDEX IF NOT EXISTS idx_links_rq ON riam_quater_links(riam_quater_id);
CREATE INDEX IF NOT EXISTS idx_rateations_interruption ON rateations(interruption_reason) WHERE interruption_reason IS NOT NULL;