-- Fase 1: Schema Database per Sistema Migrazione Parziale Cartelle

-- 1. Tabella cartelle/debts
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  description TEXT,
  original_amount_cents BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabella relazione rateazione-cartelle (molti-a-molti) con stato migrazione
CREATE TABLE IF NOT EXISTS public.rateation_debts (
  rateation_id BIGINT REFERENCES public.rateations(id) ON DELETE CASCADE,
  debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'migrated_out', 'migrated_in')),
  target_rateation_id BIGINT REFERENCES public.rateations(id),
  migrated_at DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (rateation_id, debt_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_rateation_debts_rateation ON rateation_debts(rateation_id);
CREATE INDEX IF NOT EXISTS idx_rateation_debts_debt ON rateation_debts(debt_id);
CREATE INDEX IF NOT EXISTS idx_rateation_debts_target ON rateation_debts(target_rateation_id);
CREATE INDEX IF NOT EXISTS idx_rateation_debts_status ON rateation_debts(status);

-- RLS per debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view debts linked to their rateations" 
ON public.debts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM rateation_debts rd 
    JOIN rateations r ON r.id = rd.rateation_id 
    WHERE rd.debt_id = debts.id AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY "Users can create debts" 
ON public.debts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update debts linked to their rateations" 
ON public.debts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM rateation_debts rd 
    JOIN rateations r ON r.id = rd.rateation_id 
    WHERE rd.debt_id = debts.id AND r.owner_uid = auth.uid()
  )
);

-- RLS per rateation_debts
ALTER TABLE public.rateation_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their rateation debts" 
ON public.rateation_debts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE r.id = rateation_debts.rateation_id AND r.owner_uid = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE r.id = rateation_debts.target_rateation_id AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY "Users can create rateation debts for their rateations" 
ON public.rateation_debts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE r.id = rateation_debts.rateation_id AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY "Users can update their rateation debts" 
ON public.rateation_debts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE r.id = rateation_debts.rateation_id AND r.owner_uid = auth.uid()
  )
);

CREATE POLICY "Users can delete their rateation debts" 
ON public.rateation_debts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM rateations r 
    WHERE r.id = rateation_debts.rateation_id AND r.owner_uid = auth.uid()
  )
);

-- Trigger per updated_at su debts
CREATE TRIGGER update_debts_updated_at
BEFORE UPDATE ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();