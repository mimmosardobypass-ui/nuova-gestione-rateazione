-- ============================================================================
-- Migration: F24 ↔ PagoPA Linking System v1.0 (DB-only)
-- Date: 2025-01-09
-- Author: AI Assistant
-- Description: Implementa sistema di collegamento bidirezionale F24 ↔ PagoPA
--              con snapshot immutabili, maggiorazione automatica e KPI effettivi
-- ============================================================================

-- ============================================================================
-- STEP 1: Tabella f24_pagopa_links (snapshot immutabili al momento del link)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.f24_pagopa_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  f24_id BIGINT NOT NULL REFERENCES public.rateations(id) ON DELETE CASCADE,
  pagopa_id BIGINT NOT NULL REFERENCES public.rateations(id) ON DELETE CASCADE,
  
  -- Snapshot F24 al momento del link (IMMUTABILE)
  snapshot_f24_residual_cents BIGINT NOT NULL DEFAULT 0,
  snapshot_f24_taxpayer TEXT,
  
  -- Snapshot PagoPA al momento del link (IMMUTABILE)
  pagopa_total_cents BIGINT NOT NULL DEFAULT 0,
  pagopa_taxpayer TEXT,
  
  -- Maggiorazione allocata (calcolata automaticamente)
  maggiorazione_allocata_cents BIGINT NOT NULL DEFAULT 0,
  
  -- Metadata
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  
  -- Constraint: una F24 può essere collegata a una sola PagoPA attiva
  CONSTRAINT uq_f24_single_active_link UNIQUE (f24_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_f24_pagopa_links_f24 ON public.f24_pagopa_links(f24_id);
CREATE INDEX IF NOT EXISTS idx_f24_pagopa_links_pagopa ON public.f24_pagopa_links(pagopa_id);
CREATE INDEX IF NOT EXISTS idx_f24_pagopa_links_linked_at ON public.f24_pagopa_links(linked_at DESC);

-- ============================================================================
-- STEP 2: RLS Policies per f24_pagopa_links
-- ============================================================================
ALTER TABLE public.f24_pagopa_links ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: utente può vedere solo link delle proprie rateazioni
CREATE POLICY "Users can view their F24-PagoPA links"
ON public.f24_pagopa_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rateations r
    WHERE (r.id = f24_pagopa_links.f24_id OR r.id = f24_pagopa_links.pagopa_id)
      AND r.owner_uid = auth.uid()
  )
);

-- Policy INSERT: utente può creare link solo per proprie rateazioni
CREATE POLICY "Users can create links for their rateations"
ON public.f24_pagopa_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rateations r1
    WHERE r1.id = f24_pagopa_links.f24_id
      AND r1.owner_uid = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.rateations r2
    WHERE r2.id = f24_pagopa_links.pagopa_id
      AND r2.owner_uid = auth.uid()
  )
);

-- Policy UPDATE: utente può aggiornare solo link delle proprie rateazioni
CREATE POLICY "Users can update their F24-PagoPA links"
ON public.f24_pagopa_links
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rateations r
    WHERE (r.id = f24_pagopa_links.f24_id OR r.id = f24_pagopa_links.pagopa_id)
      AND r.owner_uid = auth.uid()
  )
);

-- Policy DELETE: utente può eliminare solo link delle proprie rateazioni
CREATE POLICY "Users can delete their F24-PagoPA links"
ON public.f24_pagopa_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rateations r
    WHERE (r.id = f24_pagopa_links.f24_id OR r.id = f24_pagopa_links.pagopa_id)
      AND r.owner_uid = auth.uid()
  )
);

-- ============================================================================
-- STEP 3: RPC link_f24_to_pagopa_atomic (SECURITY DEFINER)
-- ============================================================================
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
  -- 1. Verifica ownership F24
  IF NOT EXISTS (
    SELECT 1 FROM public.rateations
    WHERE id = p_f24_id
      AND owner_uid = auth.uid()
      AND is_f24 = TRUE
  ) THEN
    RAISE EXCEPTION 'F24_ACCESS_DENIED: F24 not found or access denied';
  END IF;

  -- 2. Verifica ownership PagoPA
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

  -- 3. Calcola snapshot F24 (solo rate non pagate)
  SELECT
    COALESCE(SUM(i.amount_cents), 0),
    r.taxpayer_name
  INTO v_f24_residual_cents, v_f24_taxpayer
  FROM public.rateations r
  LEFT JOIN public.installments i ON i.rateation_id = r.id AND i.is_paid = FALSE
  WHERE r.id = p_f24_id
  GROUP BY r.taxpayer_name;

  -- 4. Calcola snapshot PagoPA (tutte le rate)
  SELECT
    COALESCE(SUM(i.amount_cents), 0),
    r.taxpayer_name
  INTO v_pagopa_total_cents, v_pagopa_taxpayer
  FROM public.rateations r
  LEFT JOIN public.installments i ON i.rateation_id = r.id
  WHERE r.id = p_pagopa_id
  GROUP BY r.taxpayer_name;

  -- 5. Calcola maggiorazione (PagoPA - F24)
  v_maggiorazione_cents := GREATEST(0, v_pagopa_total_cents - v_f24_residual_cents);

  -- 6. Check se esiste già un link per questa F24
  SELECT id INTO v_existing_link_id
  FROM public.f24_pagopa_links
  WHERE f24_id = p_f24_id;

  IF v_existing_link_id IS NOT NULL THEN
    -- UPDATE esistente
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
    -- INSERT nuovo
    INSERT INTO public.f24_pagopa_links (
      f24_id,
      pagopa_id,
      snapshot_f24_residual_cents,
      snapshot_f24_taxpayer,
      pagopa_total_cents,
      pagopa_taxpayer,
      maggiorazione_allocata_cents,
      reason
    ) VALUES (
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

  -- 7. Marca F24 come INTERROTTA (se non lo è già)
  UPDATE public.rateations
  SET status = 'INTERROTTA',
      interruption_reason = 'F24_PAGOPA_LINK',
      interrupted_at = COALESCE(interrupted_at, NOW())
  WHERE id = p_f24_id
    AND status != 'INTERROTTA';

  -- 8. Return dati per UI
  RETURN QUERY
  SELECT
    v_link_id,
    p_f24_id,
    p_pagopa_id,
    v_maggiorazione_cents,
    v_action;
END;
$$;

-- Grant execute su authenticated
REVOKE ALL ON FUNCTION public.link_f24_to_pagopa_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_f24_to_pagopa_atomic TO authenticated;

-- ============================================================================
-- STEP 4: RPC unlink_f24_from_pagopa (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.unlink_f24_from_pagopa(
  p_f24_id BIGINT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  f24_id BIGINT,
  action TEXT,
  f24_restored BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_found BOOLEAN := FALSE;
  v_f24_restored BOOLEAN := FALSE;
BEGIN
  -- 1. Verifica ownership F24
  IF NOT EXISTS (
    SELECT 1 FROM public.rateations
    WHERE id = p_f24_id
      AND owner_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'F24_ACCESS_DENIED: F24 not found or access denied';
  END IF;

  -- 2. Check se esiste link
  SELECT EXISTS (
    SELECT 1 FROM public.f24_pagopa_links
    WHERE f24_id = p_f24_id
  ) INTO v_link_found;

  -- 3. Elimina link
  DELETE FROM public.f24_pagopa_links
  WHERE f24_id = p_f24_id;

  -- 4. Ripristina F24 ad ATTIVA (trigger lo farà automaticamente)
  -- Il trigger trg_restore_f24_on_link_delete gestisce il ripristino

  -- 5. Verifica se F24 è stata ripristinata
  SELECT (status = 'ATTIVA') INTO v_f24_restored
  FROM public.rateations
  WHERE id = p_f24_id;

  -- 6. Return risultato
  RETURN QUERY
  SELECT
    p_f24_id,
    CASE WHEN v_link_found THEN 'deleted'::TEXT ELSE 'not_found'::TEXT END,
    v_f24_restored;
END;
$$;

-- Grant execute su authenticated
REVOKE ALL ON FUNCTION public.unlink_f24_from_pagopa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_f24_from_pagopa TO authenticated;

-- ============================================================================
-- STEP 5: RPC get_pagopa_available_for_f24 (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pagopa_available_for_f24(
  p_f24_id BIGINT
)
RETURNS TABLE(
  id BIGINT,
  number TEXT,
  taxpayer_name TEXT,
  pagopa_total_cents BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.number,
    r.taxpayer_name,
    COALESCE((
      SELECT SUM(i.amount_cents)
      FROM public.installments i
      WHERE i.rateation_id = r.id
    ), 0) AS pagopa_total_cents
  FROM public.rateations r
  WHERE r.owner_uid = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rateation_types rt
      WHERE rt.id = r.type_id
        AND UPPER(COALESCE(rt.name, '')) LIKE '%PAGOPA%'
    )
    AND r.status NOT IN ('INTERROTTA', 'ESTINTA', 'decaduta')
    AND r.id != p_f24_id
  ORDER BY r.number;
$$;

-- Grant execute su authenticated
REVOKE ALL ON FUNCTION public.get_pagopa_available_for_f24 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pagopa_available_for_f24 TO authenticated;

-- ============================================================================
-- STEP 6: Trigger per ripristino automatico F24 su eliminazione link
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_restore_f24_on_link_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ripristina F24 ad ATTIVA solo se era INTERROTTA per F24_PAGOPA_LINK
  UPDATE public.rateations
  SET status = 'ATTIVA',
      interruption_reason = NULL,
      interrupted_at = NULL
  WHERE id = OLD.f24_id
    AND status = 'INTERROTTA'
    AND interruption_reason = 'F24_PAGOPA_LINK';

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_f24_on_link_delete ON public.f24_pagopa_links;
CREATE TRIGGER trg_restore_f24_on_link_delete
AFTER DELETE ON public.f24_pagopa_links
FOR EACH ROW
EXECUTE FUNCTION public.trg_restore_f24_on_link_delete();

-- ============================================================================
-- STEP 7: VIEW v_f24_pagopa_maggiorazione (report maggiorazioni)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_f24_pagopa_maggiorazione AS
SELECT
  l.id AS link_id,
  l.f24_id,
  f24.number AS f24_number,
  f24.taxpayer_name AS f24_taxpayer,
  l.pagopa_id,
  pag.number AS pagopa_number,
  pag.taxpayer_name AS pagopa_taxpayer,
  l.snapshot_f24_residual_cents,
  l.pagopa_total_cents,
  l.maggiorazione_allocata_cents,
  l.linked_at,
  l.reason
FROM public.f24_pagopa_links l
INNER JOIN public.rateations f24 ON f24.id = l.f24_id
INNER JOIN public.rateations pag ON pag.id = l.pagopa_id
ORDER BY l.linked_at DESC;

-- ============================================================================
-- STEP 8: VIEW v_f24_linked_status (stato F24 con link attivi)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_f24_linked_status AS
SELECT
  r.id AS f24_id,
  r.number AS f24_number,
  r.taxpayer_name AS f24_taxpayer,
  r.status AS f24_status,
  l.id AS link_id,
  l.pagopa_id,
  pag.number AS pagopa_number,
  l.maggiorazione_allocata_cents,
  l.linked_at
FROM public.rateations r
LEFT JOIN public.f24_pagopa_links l ON l.f24_id = r.id
LEFT JOIN public.rateations pag ON pag.id = l.pagopa_id
WHERE r.is_f24 = TRUE
ORDER BY r.number;

-- ============================================================================
-- STEP 9: VIEW v_kpi_rateations_effective (KPI che esclude F24 INTERROTTE)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_kpi_rateations_effective AS
SELECT
  COALESCE(SUM(
    CASE
      -- Escludi F24 INTERROTTE per F24_PAGOPA_LINK dal residuo
      WHEN r.is_f24 = TRUE
           AND r.status = 'INTERROTTA'
           AND r.interruption_reason = 'F24_PAGOPA_LINK'
      THEN 0
      ELSE r.residual_amount_cents
    END
  ), 0) AS effective_residual_amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid();

-- ============================================================================
-- STEP 10: VIEW v_kpi_rateations_overdue_effective (Overdue effettivi)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_kpi_rateations_overdue_effective AS
SELECT
  COALESCE(SUM(
    CASE
      -- Escludi F24 INTERROTTE per F24_PAGOPA_LINK dall'overdue
      WHEN r.is_f24 = TRUE
           AND r.status = 'INTERROTTA'
           AND r.interruption_reason = 'F24_PAGOPA_LINK'
      THEN 0
      ELSE r.overdue_amount_cents
    END
  ), 0) AS effective_overdue_amount_cents
FROM public.rateations r
WHERE r.owner_uid = auth.uid();

-- ============================================================================
-- STEP 11: Commento finale
-- ============================================================================
COMMENT ON TABLE public.f24_pagopa_links IS 'Tabella di collegamento F24 ↔ PagoPA con snapshot immutabili e maggiorazione automatica (v1.0)';
COMMENT ON FUNCTION public.link_f24_to_pagopa_atomic IS 'RPC atomica per collegare F24 a PagoPA con snapshot e maggiorazione (SECURITY DEFINER)';
COMMENT ON FUNCTION public.unlink_f24_from_pagopa IS 'RPC atomica per scollegare F24 da PagoPA e ripristinare stato (SECURITY DEFINER)';
COMMENT ON FUNCTION public.get_pagopa_available_for_f24 IS 'RPC per recuperare PagoPA disponibili per collegamento F24 (SECURITY DEFINER)';
COMMENT ON VIEW public.v_f24_pagopa_maggiorazione IS 'Vista report maggiorazioni F24 ↔ PagoPA con dati snapshot';
COMMENT ON VIEW public.v_f24_linked_status IS 'Vista stato F24 con link attivi e info PagoPA collegata';
COMMENT ON VIEW public.v_kpi_rateations_effective IS 'KPI residuo effettivo (esclude F24 INTERROTTE per F24_PAGOPA_LINK)';
COMMENT ON VIEW public.v_kpi_rateations_overdue_effective IS 'KPI overdue effettivo (esclude F24 INTERROTTE per F24_PAGOPA_LINK)';