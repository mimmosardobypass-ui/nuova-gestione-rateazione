-- Complete Test Data Setup for Migration System

-- 1. Create RQ type 
INSERT INTO rateation_types (name, description, is_active) 
VALUES ('RQ', 'Ruolo Quietanza - Piano di destinazione per migrazioni PagoPA', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Get a valid owner_uid and create RQ plans
INSERT INTO rateations (
  number, 
  type_id, 
  taxpayer_name, 
  total_amount, 
  status, 
  owner_uid
) 
SELECT 
  'RQ-001/2024', 
  rt.id,
  'Piano RQ Destinazione 1', 
  0, 
  'attiva',
  r.owner_uid
FROM rateation_types rt, rateations r
WHERE rt.name = 'RQ' 
  AND r.owner_uid IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM rateations WHERE number = 'RQ-001/2024')
LIMIT 1;

INSERT INTO rateations (
  number, 
  type_id, 
  taxpayer_name, 
  total_amount, 
  status, 
  owner_uid
) 
SELECT 
  'RQ-002/2024', 
  rt.id,
  'Piano RQ Destinazione 2', 
  0, 
  'attiva',
  r.owner_uid
FROM rateation_types rt, rateations r
WHERE rt.name = 'RQ' 
  AND r.owner_uid IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM rateations WHERE number = 'RQ-002/2024')
LIMIT 1;

-- 3. Create test debts
INSERT INTO debts (number, description, original_amount_cents) VALUES 
('DEBT-001-2024', 'Cartella Esattoriale Test 1 - IVA 2022', 150000),
('DEBT-002-2024', 'Cartella Esattoriale Test 2 - IRPEF 2022', 280000),
('DEBT-003-2024', 'Cartella Esattoriale Test 3 - IRAP 2023', 95000)
ON CONFLICT (number) DO NOTHING;

-- 4. Link specific debts to specific PagoPA plans (avoid conflicts)
INSERT INTO rateation_debts (rateation_id, debt_id, status)
SELECT 27, d.id, 'active'
FROM debts d 
WHERE d.number = 'DEBT-001-2024'
  AND NOT EXISTS (SELECT 1 FROM rateation_debts WHERE rateation_id = 27 AND debt_id = d.id);

INSERT INTO rateation_debts (rateation_id, debt_id, status)
SELECT 28, d.id, 'active'
FROM debts d 
WHERE d.number = 'DEBT-002-2024'
  AND NOT EXISTS (SELECT 1 FROM rateation_debts WHERE rateation_id = 28 AND debt_id = d.id);

INSERT INTO rateation_debts (rateation_id, debt_id, status)
SELECT 31, d.id, 'active'
FROM debts d 
WHERE d.number = 'DEBT-003-2024'
  AND NOT EXISTS (SELECT 1 FROM rateation_debts WHERE rateation_id = 31 AND debt_id = d.id);