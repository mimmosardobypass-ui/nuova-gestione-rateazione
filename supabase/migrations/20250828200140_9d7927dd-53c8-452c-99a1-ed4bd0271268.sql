-- Simple test data setup - minimal approach

-- Just ensure RQ type exists  
INSERT INTO rateation_types (name, description) 
SELECT 'RQ', 'Ruolo Quietanza'
WHERE NOT EXISTS (SELECT 1 FROM rateation_types WHERE name = 'RQ');

-- Create minimal debts
INSERT INTO debts (number, description, original_amount_cents) 
SELECT 'TEST-DEBT-A', 'Test Debt A', 100000
WHERE NOT EXISTS (SELECT 1 FROM debts WHERE number = 'TEST-DEBT-A');

INSERT INTO debts (number, description, original_amount_cents) 
SELECT 'TEST-DEBT-B', 'Test Debt B', 200000  
WHERE NOT EXISTS (SELECT 1 FROM debts WHERE number = 'TEST-DEBT-B');