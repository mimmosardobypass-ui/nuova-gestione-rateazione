-- ==============
-- 1. Aggiungi colonna unlinked_at per gestire sgancio soft-delete
-- ==============
ALTER TABLE riam_quater_links 
ADD COLUMN IF NOT EXISTS unlinked_at timestamp with time zone;

-- ==============
-- 2. Indice unico: una RQ può avere solo un link attivo alla volta
-- ==============
CREATE UNIQUE INDEX IF NOT EXISTS uq_rq_active
ON riam_quater_links(riam_quater_id)
WHERE unlinked_at IS NULL;

-- ==============
-- 3. RPC MIGRAZIONE ATOMICA: PagoPA -> una o più RQ
-- Imposta PagoPA a 'INTERROTTA' e crea i link in un'unica transazione.
-- ==============
CREATE OR REPLACE FUNCTION public.pagopa_migrate_attach_rq(
  p_pagopa_id bigint,
  p_rq_ids bigint[],
  p_note text DEFAULT NULL
)
RETURNS TABLE (link_id bigint, riam_quater_id bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pagopa boolean;
  v_rq_id bigint;
  v_link_id bigint;
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied to PagoPA';
  END IF;

  IF p_rq_ids IS NULL OR array_length(p_rq_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nessuna RQ selezionata';
  END IF;

  -- Verifica tipo PagoPA (case-insensitive)
  SELECT EXISTS(
    SELECT 1
    FROM rateations r
    JOIN rateation_types t ON t.id = r.type_id
    WHERE r.id = p_pagopa_id
      AND UPPER(t.name) = 'PAGOPA'
      AND r.owner_uid = auth.uid()
  ) INTO v_is_pagopa;

  IF NOT v_is_pagopa THEN
    RAISE EXCEPTION 'La rateazione % non è di tipo PagoPA', p_pagopa_id;
  END IF;

  -- Imposta la PagoPA a INTERROTTA
  UPDATE rateations
  SET status = 'INTERROTTA',
      interruption_reason = COALESCE(interruption_reason, 'RQ_LINK'),
      interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
  WHERE id = p_pagopa_id
    AND owner_uid = auth.uid();

  -- Crea link per ciascuna RQ selezionata (evita duplicati attivi)
  FOREACH v_rq_id IN ARRAY p_rq_ids LOOP
    -- Check ownership of RQ
    IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = v_rq_id AND owner_uid = auth.uid()) THEN
      RAISE EXCEPTION 'Access denied to RQ %', v_rq_id;
    END IF;

    -- Insert link if not already active
    IF NOT EXISTS (
      SELECT 1 FROM riam_quater_links l
      WHERE l.riam_quater_id = v_rq_id AND l.unlinked_at IS NULL
    ) THEN
      INSERT INTO riam_quater_links(pagopa_id, riam_quater_id, reason)
      VALUES (p_pagopa_id, v_rq_id, p_note)
      RETURNING id INTO v_link_id;
      
      RETURN QUERY SELECT v_link_id, v_rq_id;
    END IF;
  END LOOP;
END;
$$;

-- ==============
-- 4. RPC SGANCIO ATOMICO: chiude i link; se non restano link attivi, PagoPA torna ATTIVA
-- ==============
CREATE OR REPLACE FUNCTION public.pagopa_unlink_rq(
  p_pagopa_id bigint,
  p_rq_ids bigint[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied to PagoPA';
  END IF;

  -- Chiudi link attivi (tutti o solo quelli passati)
  UPDATE riam_quater_links
  SET unlinked_at = NOW()
  WHERE pagopa_id = p_pagopa_id
    AND unlinked_at IS NULL
    AND (p_rq_ids IS NULL OR riam_quater_id = ANY(p_rq_ids));

  -- Se non restano link attivi -> PagoPA torna ATTIVA
  SELECT COUNT(*) INTO v_remaining
  FROM riam_quater_links
  WHERE pagopa_id = p_pagopa_id
    AND unlinked_at IS NULL;

  IF v_remaining = 0 THEN
    UPDATE rateations
    SET status = 'attiva',
        interrupted_at = NULL,
        interruption_reason = NULL
    WHERE id = p_pagopa_id
      AND owner_uid = auth.uid();
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ==============
-- 5. RPC LISTA RQ DISPONIBILI per una specifica PagoPA
-- (esclude RQ già collegate a qualunque PagoPA con link attivi)
-- ==============
CREATE OR REPLACE FUNCTION public.get_rq_available_for_pagopa(p_pagopa_id bigint)
RETURNS TABLE (
  id bigint,
  number text,
  taxpayer_name text,
  quater_total_due_cents bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rq.id, rq.number, rq.taxpayer_name, rq.quater_total_due_cents
  FROM rateations rq
  JOIN rateation_types rt ON rt.id = rq.type_id
  WHERE UPPER(rt.name) LIKE '%QUATER%'
    AND rq.is_quater = true
    AND rq.owner_uid = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM riam_quater_links l
      WHERE l.riam_quater_id = rq.id 
        AND l.unlinked_at IS NULL
    )
  ORDER BY rq.id DESC;
$$;

-- ==============
-- 6. Aggiorna pagopa_lock_for_rq per usare unlinked_at
-- ==============
CREATE OR REPLACE FUNCTION public.pagopa_lock_for_rq(p_pagopa_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Lock only if there are active links
  IF EXISTS (
    SELECT 1 FROM riam_quater_links 
    WHERE pagopa_id = p_pagopa_id 
      AND unlinked_at IS NULL
  ) THEN
    UPDATE rateations
    SET status = 'INTERROTTA',
        interruption_reason = 'RQ_LINK',
        interrupted_at = COALESCE(interrupted_at, CURRENT_DATE)
    WHERE id = p_pagopa_id
      AND owner_uid = auth.uid();
  END IF;
END;
$$;

-- ==============
-- 7. Aggiorna pagopa_unlock_if_no_links per usare unlinked_at
-- ==============
CREATE OR REPLACE FUNCTION public.pagopa_unlock_if_no_links(p_pagopa_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_links boolean;
BEGIN
  -- Check ownership
  IF NOT EXISTS(SELECT 1 FROM rateations WHERE id = p_pagopa_id AND owner_uid = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check for active links
  SELECT EXISTS (
    SELECT 1 FROM riam_quater_links 
    WHERE pagopa_id = p_pagopa_id 
      AND unlinked_at IS NULL
  ) INTO v_has_links;

  IF NOT v_has_links THEN
    UPDATE rateations
    SET status = 'attiva',
        interrupted_at = NULL,
        interruption_reason = NULL
    WHERE id = p_pagopa_id
      AND owner_uid = auth.uid()
      AND status = 'INTERROTTA'
      AND interruption_reason = 'RQ_LINK';
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ==============
-- 8. Vista KPI: residuo PagoPA con link attivi = 0
-- ==============
CREATE OR REPLACE VIEW v_kpi_rateations_effective AS
SELECT 
  COALESCE(SUM(
    CASE
      -- PagoPA con link attivi: residuo = 0
      WHEN EXISTS (
        SELECT 1 FROM rateation_types tt
        WHERE tt.id = r.type_id AND UPPER(tt.name) = 'PAGOPA'
      )
      AND EXISTS (
        SELECT 1 FROM riam_quater_links l
        WHERE l.pagopa_id = r.id AND l.unlinked_at IS NULL
      )
      THEN 0
      -- Rateazioni interrotte: usa snapshot
      WHEN r.status = 'INTERROTTA' 
      THEN 0
      -- Altre rateazioni: usa residuo calcolato
      ELSE COALESCE(r.residual_amount_cents, 0)
    END
  ), 0) AS effective_residual_amount_cents
FROM rateations r
WHERE r.owner_uid = auth.uid();