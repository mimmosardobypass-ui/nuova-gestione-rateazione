-- ========================================
-- SOFT-DELETE FOUNDATION: Colonne + RPC
-- Migration 1/3: Aggiunge colonne soft-delete e RPC sicura
-- ========================================

-- 1. Aggiungi colonne soft-delete (idempotente)
ALTER TABLE public.rateations 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 2. Indice performance per query non-deleted (critico!)
CREATE INDEX IF NOT EXISTS idx_rateations_not_deleted 
ON public.rateations (owner_uid, id) 
WHERE (is_deleted = FALSE);

-- 3. Commenti esplicativi
COMMENT ON COLUMN public.rateations.is_deleted IS 'Soft-delete flag: TRUE = logically deleted, FALSE = active';
COMMENT ON COLUMN public.rateations.deleted_at IS 'Timestamp of soft-delete operation';
COMMENT ON COLUMN public.rateations.deleted_by IS 'User ID who performed the deletion';
COMMENT ON INDEX idx_rateations_not_deleted IS 'Performance index for active rateations (filters out soft-deleted)';

-- 4. RPC sicura per soft-delete
CREATE OR REPLACE FUNCTION public.delete_rateation_safely(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner UUID;
  v_number TEXT;
BEGIN
  -- Verifica autenticazione
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'UNAUTHORIZED');
  END IF;

  -- Lock row e verifica proprietà
  SELECT owner_uid, number INTO v_owner, v_number
  FROM public.rateations
  WHERE id = p_id 
    AND COALESCE(is_deleted, FALSE) = FALSE
  FOR UPDATE;

  -- Controlli sicurezza
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_FOUND');
  END IF;

  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'FORBIDDEN');
  END IF;

  -- Soft-delete atomico
  UPDATE public.rateations
  SET is_deleted = TRUE,
      deleted_at = NOW(),
      deleted_by = v_uid
  WHERE id = p_id;

  -- Success con dettagli
  RETURN jsonb_build_object(
    'ok', TRUE, 
    'deleted_id', p_id,
    'deleted_number', v_number
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error e return failure
  RAISE WARNING 'delete_rateation_safely error: %', SQLERRM;
  RETURN jsonb_build_object('ok', FALSE, 'error', 'INTERNAL_ERROR', 'detail', SQLERRM);
END;
$$;

-- 5. Grant esecuzione (solo authenticated)
REVOKE ALL ON FUNCTION public.delete_rateation_safely(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_rateation_safely(BIGINT) TO authenticated, service_role;

-- 6. Commento documentazione
COMMENT ON FUNCTION public.delete_rateation_safely(BIGINT) IS 
'Performs soft-delete on rateation. Returns JSON: {"ok": true} on success, {"ok": false, "error": "code"} on failure. Error codes: UNAUTHORIZED, NOT_FOUND, FORBIDDEN, INTERNAL_ERROR';