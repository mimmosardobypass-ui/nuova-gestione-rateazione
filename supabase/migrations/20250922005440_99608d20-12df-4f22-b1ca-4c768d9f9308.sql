-- FASE 2: MIGRAZIONI DATABASE per gestione PagoPA interrotte

-- 2.1 - Estensione tabella rateations con campi interruzione
ALTER TABLE rateations
  ADD COLUMN IF NOT EXISTS interrupted_at date,
  ADD COLUMN IF NOT EXISTS interruption_reason text,
  ADD COLUMN IF NOT EXISTS interrupted_by_rateation_id bigint REFERENCES rateations(id) ON DELETE SET NULL;

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_rateations_interrupted_by ON rateations(interrupted_by_rateation_id);

-- 2.2 - Tabella collegamenti Riam.Quater ↔ PagoPA (uno-a-molti)
CREATE TABLE IF NOT EXISTS riam_quater_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  riam_quater_id bigint NOT NULL REFERENCES rateations(id) ON DELETE CASCADE,
  pagopa_id bigint NOT NULL REFERENCES rateations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (riam_quater_id, pagopa_id)
);

-- Indici per performance sui collegamenti
CREATE INDEX IF NOT EXISTS idx_rql_riam ON riam_quater_links(riam_quater_id);
CREATE INDEX IF NOT EXISTS idx_rql_pagopa ON riam_quater_links(pagopa_id);

-- 2.3 - RLS Policies per riam_quater_links (seguono pattern esistente)
ALTER TABLE riam_quater_links ENABLE ROW LEVEL SECURITY;

-- Policy per SELECT: utenti possono vedere solo i collegamenti delle proprie rateazioni
CREATE POLICY "Users can view their riam quater links" 
ON riam_quater_links 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE (r.id = riam_quater_links.riam_quater_id OR r.id = riam_quater_links.pagopa_id) 
    AND r.owner_uid = auth.uid()
  )
);

-- Policy per INSERT: utenti possono creare collegamenti solo per le proprie rateazioni
CREATE POLICY "Users can create links for their rateations" 
ON riam_quater_links 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rateations r1 
    WHERE r1.id = riam_quater_links.riam_quater_id AND r1.owner_uid = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM rateations r2 
    WHERE r2.id = riam_quater_links.pagopa_id AND r2.owner_uid = auth.uid()
  )
);

-- Policy per UPDATE: utenti possono modificare solo i propri collegamenti
CREATE POLICY "Users can update their riam quater links" 
ON riam_quater_links 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE (r.id = riam_quater_links.riam_quater_id OR r.id = riam_quater_links.pagopa_id) 
    AND r.owner_uid = auth.uid()
  )
);

-- Policy per DELETE: utenti possono eliminare solo i propri collegamenti
CREATE POLICY "Users can delete their riam quater links" 
ON riam_quater_links 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE (r.id = riam_quater_links.riam_quater_id OR r.id = riam_quater_links.pagopa_id) 
    AND r.owner_uid = auth.uid()
  )
);