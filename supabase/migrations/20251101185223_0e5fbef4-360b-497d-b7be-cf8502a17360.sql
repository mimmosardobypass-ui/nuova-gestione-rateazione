-- Correzione flag is_f24 errati per rateazioni PagoPA
-- IDs 27, 28, 29 sono PagoPA ma hanno erroneamente is_f24 = true

UPDATE rateations 
SET is_f24 = false 
WHERE id IN (27, 28, 29)
  AND is_f24 = true;

-- Verifica post-correzione
-- Questa query non modifica dati, serve solo per logging
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rateations
  WHERE id IN (27, 28, 29) AND is_f24 = false;
  
  RAISE NOTICE 'Corretti % flag is_f24 per rateazioni PagoPA (IDs: 27, 28, 29)', v_count;
END $$;