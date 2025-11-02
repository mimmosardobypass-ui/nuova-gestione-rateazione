-- Normalizzazione tipi rateazioni Quater
-- Step 1: Rinomina "Quater" in "Rottamazione Quater" per le rateazioni originali (1 e 2)
UPDATE rateation_types 
SET name = 'Rottamazione Quater' 
WHERE id = 8 AND name = 'Quater';

-- Step 2: Disattiva il tipo "RQ" duplicato (non usato da nessuna rateazione)
UPDATE rateation_types 
SET is_active = false 
WHERE id = 19 AND name = 'RQ';

-- Verifica risultati
COMMENT ON TABLE rateation_types IS 'Normalizzati i tipi Quater: "Rottamazione Quater" per rateazioni 1-2, "Riam.Quater" per 1RQ-12RQ';
