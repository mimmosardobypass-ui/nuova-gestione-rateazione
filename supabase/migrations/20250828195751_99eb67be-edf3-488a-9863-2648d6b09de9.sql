-- Phase 2: Setup Test Data for Migration System

-- 1. Create RQ type if missing
INSERT INTO rateation_types (name, description, is_active) 
VALUES ('RQ', 'Ruolo Quietanza - Piano di destinazione per migrazioni PagoPA', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Create 2 test RQ plans to serve as migration destinations
INSERT INTO rateations (
  number, 
  type_id, 
  taxpayer_name, 
  total_amount, 
  status, 
  owner_uid
) VALUES 
(
  'RQ-001/2024', 
  (SELECT id FROM rateation_types WHERE name = 'RQ' LIMIT 1),
  'Piano RQ Destinazione 1', 
  0, 
  'attiva',
  auth.uid()
),
(
  'RQ-002/2024', 
  (SELECT id FROM rateation_types WHERE name = 'RQ' LIMIT 1),
  'Piano RQ Destinazione 2', 
  0, 
  'attiva',
  auth.uid()
)
ON CONFLICT DO NOTHING;

-- 3. Create some test debts (cartelle)
INSERT INTO debts (number, description, original_amount_cents) VALUES 
('DEBT-001-2024', 'Cartella Esattoriale Test 1 - IVA 2022', 150000),
('DEBT-002-2024', 'Cartella Esattoriale Test 2 - IRPEF 2022', 280000),
('DEBT-003-2024', 'Cartella Esattoriale Test 3 - IRAP 2023', 95000),
('DEBT-004-2024', 'Cartella Esattoriale Test 4 - Sanzioni Amministrative', 45000)
ON CONFLICT (number) DO NOTHING;

-- 4. Link debts to existing PagoPA plans (rateation IDs 27, 28, 29, 30, 31)
-- Link 2-3 debts per PagoPA plan to enable partial migration testing
INSERT INTO rateation_debts (rateation_id, debt_id, status) 
SELECT r.id, d.id, 'active'
FROM rateations r
CROSS JOIN debts d
WHERE r.id IN (27, 28, 29, 30, 31) -- PagoPA plans from query above
  AND d.number IN ('DEBT-001-2024', 'DEBT-002-2024', 'DEBT-003-2024', 'DEBT-004-2024')
  AND (
    -- Distribute debts across plans for realistic testing
    (r.id = 27 AND d.number IN ('DEBT-001-2024', 'DEBT-002-2024')) OR
    (r.id = 28 AND d.number IN ('DEBT-002-2024', 'DEBT-003-2024')) OR  
    (r.id = 29 AND d.number IN ('DEBT-003-2024', 'DEBT-004-2024')) OR
    (r.id = 30 AND d.number IN ('DEBT-001-2024', 'DEBT-004-2024')) OR
    (r.id = 31 AND d.number IN ('DEBT-001-2024', 'DEBT-002-2024', 'DEBT-003-2024'))
  )
ON CONFLICT (rateation_id, debt_id) DO UPDATE SET status = 'active';