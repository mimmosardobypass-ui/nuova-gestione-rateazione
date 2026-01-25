-- =====================================================
-- ROTTAMAZIONE QUINQUIES (2026) - Struttura Database
-- =====================================================

-- 1. Nuova colonna is_quinquies sulla tabella rateations
ALTER TABLE public.rateations 
ADD COLUMN IF NOT EXISTS is_quinquies BOOLEAN DEFAULT false;

-- 2. Inserisci nuovo tipo "Rottamazione Quinquies" (se non esiste già)
INSERT INTO public.rateation_types (name, description, color, is_active)
SELECT 'Rottamazione Quinquies', 'Rottamazione Quinquies 2026', '#8B5CF6', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.rateation_types WHERE name = 'Rottamazione Quinquies'
);

-- 3. Tabella quinquies_links (stessa struttura di riam_quater_links)
CREATE TABLE IF NOT EXISTS public.quinquies_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quinquies_id BIGINT NOT NULL REFERENCES public.rateations(id),
  pagopa_id BIGINT NOT NULL REFERENCES public.rateations(id),
  pagopa_residual_at_link_cents BIGINT,
  pagopa_taxpayer_at_link TEXT,
  quinquies_total_at_link_cents BIGINT,
  quinquies_taxpayer_at_link TEXT,
  allocated_residual_cents BIGINT,
  risparmio_at_link_cents BIGINT GENERATED ALWAYS AS (
    GREATEST(0, COALESCE(allocated_residual_cents, 0) - COALESCE(quinquies_total_at_link_cents, 0))
  ) STORED,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlinked_at TIMESTAMPTZ
);

-- 4. Indici per performance
CREATE INDEX IF NOT EXISTS idx_quinquies_links_quinquies_id ON public.quinquies_links(quinquies_id);
CREATE INDEX IF NOT EXISTS idx_quinquies_links_pagopa_id ON public.quinquies_links(pagopa_id);
CREATE INDEX IF NOT EXISTS idx_quinquies_links_active ON public.quinquies_links(quinquies_id) WHERE unlinked_at IS NULL;

-- 5. Enable RLS
ALTER TABLE public.quinquies_links ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies per quinquies_links
CREATE POLICY "Users can view their quinquies links"
ON public.quinquies_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rateations r
    WHERE (r.id = quinquies_links.quinquies_id OR r.id = quinquies_links.pagopa_id)
    AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY "Users can create links for their rateations"
ON public.quinquies_links FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rateations r1 WHERE r1.id = quinquies_links.quinquies_id AND r1.owner_uid = auth.uid())
  AND
  EXISTS (SELECT 1 FROM public.rateations r2 WHERE r2.id = quinquies_links.pagopa_id AND r2.owner_uid = auth.uid())
);

CREATE POLICY "Users can update their quinquies links"
ON public.quinquies_links FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rateations r
    WHERE (r.id = quinquies_links.quinquies_id OR r.id = quinquies_links.pagopa_id)
    AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY "Users can delete their quinquies links"
ON public.quinquies_links FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rateations r
    WHERE (r.id = quinquies_links.quinquies_id OR r.id = quinquies_links.pagopa_id)
    AND r.owner_uid = auth.uid()
  )
);

-- 7. Vista per calcolo risparmio Quinquies per utente
CREATE OR REPLACE VIEW public.v_quinquies_saving_per_user AS
SELECT 
  r.owner_uid,
  COALESCE(SUM(ql.risparmio_at_link_cents), 0) / 100.0 AS saving_eur
FROM public.quinquies_links ql
JOIN public.rateations r ON r.id = ql.quinquies_id
WHERE ql.unlinked_at IS NULL
GROUP BY r.owner_uid;