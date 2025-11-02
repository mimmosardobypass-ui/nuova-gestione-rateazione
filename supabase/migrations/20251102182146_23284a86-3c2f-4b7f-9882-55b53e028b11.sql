-- Elimina definitivamente il tipo "RQ" duplicato
-- Verificato: 0 rateazioni usano questo tipo (id=19)
DELETE FROM rateation_types 
WHERE id = 19 AND name = 'RQ';

-- Commento per tracciabilità
COMMENT ON TABLE rateation_types IS 'Rimosso tipo duplicato RQ (id=19) - mai utilizzato da rateazioni. Tipi Quater normalizzati: Rottamazione Quater (id=8) per rateazioni 1-2, Riam.Quater (id=14) per 1RQ-12RQ';