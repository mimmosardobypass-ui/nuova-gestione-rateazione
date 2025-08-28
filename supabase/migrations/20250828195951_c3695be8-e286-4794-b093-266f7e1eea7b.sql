-- Simple test data setup without conflicts

-- 1. Create RQ type if it doesn't exist
INSERT INTO rateation_types (name, description, is_active) 
SELECT 'RQ', 'Ruolo Quietanza - Piano destinazione per migrazioni PagoPA', true
WHERE NOT EXISTS (SELECT 1 FROM rateation_types WHERE name = 'RQ');

-- 2. Create test debts if they don't exist
INSERT INTO debts (number, description, original_amount_cents) 
SELECT 'DEBT-001-2024', 'Cartella IVA 2022', 150000
WHERE NOT EXISTS (SELECT 1 FROM debts WHERE number = 'DEBT-001-2024');

INSERT INTO debts (number, description, original_amount_cents) 
SELECT 'DEBT-002-2024', 'Cartella IRPEF 2022', 280000
WHERE NOT EXISTS (SELECT 1 FROM debts WHERE number = 'DEBT-002-2024');

-- 3. Create RQ plans using existing user's ID
WITH owner_info AS (
  SELECT owner_uid FROM rateations WHERE id = 31 LIMIT 1
),
rq_info AS (
  SELECT id as type_id FROM rateation_types WHERE name = 'RQ' LIMIT 1
)
INSERT INTO rateations (number, type_id, taxpayer_name, total_amount, status, owner_uid)
SELECT 'RQ-001/2024', ri.type_id, 'Piano RQ Destinazione 1', 0, 'attiva', oi.owner_uid
FROM owner_info oi, rq_info ri
WHERE NOT EXISTS (SELECT 1 FROM rateations WHERE number = 'RQ-001/2024');

WITH owner_info AS (
  SELECT owner_uid FROM rateations WHERE id = 31 LIMIT 1
),
rq_info AS (
  SELECT id as type_id FROM rateation_types WHERE name = 'RQ' LIMIT 1
)
INSERT INTO rateations (number, type_id, taxpayer_name, total_amount, status, owner_uid)
SELECT 'RQ-002/2024', ri.type_id, 'Piano RQ Destinazione 2', 0, 'attiva', oi.owner_uid
FROM owner_info oi, rq_info ri
WHERE NOT EXISTS (SELECT 1 FROM rateations WHERE number = 'RQ-002/2024');

-- 4. Link debts to PagoPA plan 31 for testing
INSERT INTO rateation_debts (rateation_id, debt_id, status)
SELECT 31, d.id, 'active'
FROM debts d
WHERE d.number IN ('DEBT-001-2024', 'DEBT-002-2024')
  AND NOT EXISTS (
    SELECT 1 FROM rateation_debts rd 
    WHERE rd.rateation_id = 31 AND rd.debt_id = d.id
  );