-- Comprehensive test data setup for migration system

-- 1. Create RQ type (idempotent)
INSERT INTO rateation_types (name, description, is_active) 
VALUES ('RQ', 'Ruolo Quietanza - Piano destinazione per migrazioni PagoPA', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Create test debts (idempotent)  
INSERT INTO debts (number, description, original_amount_cents) VALUES 
('DEBT-001-2024', 'Cartella IVA 2022', 150000),
('DEBT-002-2024', 'Cartella IRPEF 2022', 280000),  
('DEBT-003-2024', 'Cartella IRAP 2023', 95000)
ON CONFLICT (number) DO NOTHING;

-- 3. Get the user who owns the PagoPA plans and create RQ plans for them
DO $$
DECLARE
    owner_id uuid;
    rq_type_id bigint;
BEGIN
    -- Get owner of existing PagoPA plans
    SELECT owner_uid INTO owner_id 
    FROM rateations 
    WHERE id IN (27, 28, 29, 30, 31) 
    LIMIT 1;
    
    -- Get RQ type ID
    SELECT id INTO rq_type_id 
    FROM rateation_types 
    WHERE name = 'RQ';
    
    -- Create RQ plans if owner found
    IF owner_id IS NOT NULL AND rq_type_id IS NOT NULL THEN
        INSERT INTO rateations (number, type_id, taxpayer_name, total_amount, status, owner_uid)
        VALUES 
        ('RQ-001/2024', rq_type_id, 'Piano RQ Destinazione 1', 0, 'attiva', owner_id),
        ('RQ-002/2024', rq_type_id, 'Piano RQ Destinazione 2', 0, 'attiva', owner_id)
        ON CONFLICT (number) DO NOTHING;
    END IF;
END $$;

-- 4. Link some debts to PagoPA plan 31 for testing
-- Only do this if we have both debts and the rateation
INSERT INTO rateation_debts (rateation_id, debt_id, status)
SELECT 31, d.id, 'active'
FROM debts d
WHERE d.number IN ('DEBT-001-2024', 'DEBT-002-2024')
  AND EXISTS (SELECT 1 FROM rateations WHERE id = 31)
ON CONFLICT (rateation_id, debt_id) DO UPDATE SET status = 'active';